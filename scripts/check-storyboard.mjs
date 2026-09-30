/** ponytail: storyboard encode smoke + optional Qwen describe. */
import assert from "node:assert/strict";
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildStoryboardJpeg, isMotionMime } from "../lib/search/storyboard.ts";

assert.equal(isMotionMime("image/gif"), true);
assert.equal(isMotionMime("video/mp4"), true);
assert.equal(isMotionMime("image/png"), false);

const gifUrl =
  process.argv[2] ||
  "https://i.gifer.com/origin/10/101fa298ffc7d7dd74f9f5e18b562d95_w200.webp";

const res = await fetch(gifUrl);
assert.ok(res.ok, `fetch ${gifUrl} → ${res.status}`);
const mime = res.headers.get("content-type") || "image/webp";
const bytes = Buffer.from(await res.arrayBuffer());
const t0 = Date.now();
const jpeg = await buildStoryboardJpeg(bytes, mime);
const ms = Date.now() - t0;
assert.ok(jpeg.byteLength > 1000, "storyboard too small");
assert.ok(jpeg[0] === 0xff && jpeg[1] === 0xd8, "not jpeg");

const outDir = "/tmp/blob-storyboard";
await mkdir(outDir, { recursive: true });
const outPath = join(outDir, "storyboard.jpg");
await writeFile(outPath, jpeg);
console.log(`ok: storyboard ${jpeg.byteLength} bytes in ${ms}ms → ${outPath}`);

const ollama = (process.env.OLLAMA_BASE_URL || "").replace(/\/$/, "");
if (ollama && process.env.VISION_SMOKE === "1") {
  const model = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:3b";
  const headers = { "Content-Type": "application/json" };
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  const prompt =
    "This is a 2x3 storyboard. Corner numbers 1-6 are sequence markers only — not content. What is happening across the frames?";
  const chat = await fetch(`${ollama}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: prompt,
          images: [jpeg.toString("base64")],
        },
      ],
      options: { num_predict: 220, temperature: 0.2, repeat_penalty: 1.3 },
    }),
  });
  const data = await chat.json();
  console.log("vision:", data.message?.content || data.error);
}
