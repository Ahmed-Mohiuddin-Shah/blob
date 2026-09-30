#!/usr/bin/env node
/**
 * ponytail: smoke Blob vision prompts against a Glass object URL.
 * Usage: node scripts/vision-compare.mjs [glass-object-url]
 * Needs OLLAMA_BASE_URL (+ OLLAMA_API_KEY if proxy). Optional GLASS_API_KEY.
 */
import "dotenv/config";
import sharp from "sharp";

const VISION_MAX_EDGE = 512;

const P_MOON = "Describe this image for search:";
const P_QWEN =
  "Describe this sticker for search in 2-4 sentences: subjects, text on image, emotion, and style.";
const P_JSON = `Look at this sticker image. Reply with ONLY a single JSON object. No markdown fences.

Schema: caption (string), scenario (string), tags (string[] of 5-12 underscore_phrases).
Example (shape only): {"caption":"Chibi girl with balloons","scenario":"Birthday chat energy","tags":["CHIBI_GIRL","BALLOONS","HAPPY"]}`;

const url =
  process.argv[2] ||
  "https://glass-dev-primary.mamajees.com/objects/a905b546-8e86-47cf-8781-61c08f33a2a9";

const ollama = (process.env.OLLAMA_BASE_URL || "").replace(/\/$/, "");
if (!ollama) {
  console.error("OLLAMA_BASE_URL is required");
  process.exit(1);
}

function headers(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

async function fetchImage(objectUrl) {
  const h = {};
  const gk = process.env.GLASS_API_KEY?.trim();
  if (gk) h.Authorization = `Bearer ${gk}`;
  const res = await fetch(objectUrl, { headers: h });
  if (!res.ok) throw new Error(`Glass ${res.status}: ${objectUrl}`);
  return Buffer.from(await res.arrayBuffer());
}

async function toVisionB64(bytes) {
  const jpeg = await sharp(bytes)
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return jpeg.toString("base64");
}

async function chat(model, prompt, images, options) {
  const t0 = Date.now();
  const res = await fetch(`${ollama}/api/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
          ...(images?.length ? { images } : {}),
        },
      ],
      options: {
        num_predict: options.numPredict,
        temperature: options.temperature,
        repeat_penalty: options.repeatPenalty,
      },
    }),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ms, error: `non-json ${res.status}: ${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { ms, error: data.error || `http ${res.status}`, raw: data };
  }
  return {
    ms,
    error: data.error ?? null,
    eval_count: data.eval_count ?? null,
    content: data.message?.content ?? null,
  };
}

const describeOpts = { numPredict: 220, temperature: 0.2, repeatPenalty: 1.3 };
const jsonOpts = { numPredict: 320, temperature: 0.1, repeatPenalty: 1.35 };

const bytes = await fetchImage(url);
const b64 = await toVisionB64(bytes);

const moon = await chat(
  "moondream:1.8b-v2-fp16",
  P_MOON,
  [b64],
  describeOpts,
);
const qwen = await chat("qwen2.5vl:3b", P_QWEN, [b64], describeOpts);
const qwenJson = await chat("qwen2.5vl:3b", P_JSON, [b64], jsonOpts);

const report = {
  url,
  image_edge_px: VISION_MAX_EDGE,
  ollama,
  runs: {
    moondream_fp16_describe: {
      model: "moondream:1.8b-v2-fp16",
      prompt: P_MOON,
      ...moon,
    },
    qwen_vl_describe: {
      model: "qwen2.5vl:3b",
      prompt: P_QWEN,
      ...qwen,
    },
    qwen_vl_json: {
      model: "qwen2.5vl:3b",
      prompt: "vision_json (Blob one-shot)",
      ...qwenJson,
    },
  },
};

console.log(JSON.stringify(report, null, 2));
