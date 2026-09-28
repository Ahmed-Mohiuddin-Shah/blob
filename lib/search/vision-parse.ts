export type EnrichResult = {
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
};

/** Pass 1 — moondream (image + this prompt only). */
export const VISION_DESCRIBE_PROMPT = "Describe this image for search:";

/** Placeholder / schema-echo tokens models copy from examples. */
const TAG_PLACEHOLDERS = new Set([
  "SHORT",
  "TAGS",
  "TAG",
  "VOID",
  "NONE",
  "N/A",
  "NA",
  "NULL",
  "EXAMPLE",
]);

/** Pass 2 — text model turns prose into search meta JSON. */
export function structureEnrichPrompt(description: string): string {
  return `Given this sticker description, reply with ONLY JSON (no markdown):
{"caption":"<one concrete visual sentence>","scenario":"<when someone would send this sticker>","tags":["ANIME","ANGRY","MEME","TEXT"]}

Rules for tags:
- 5 to 12 separate strings in the tags array
- ONE short word or underscore_phrase per array element (never commas inside a tag)
- Specific visuals: character, emotion, objects, style, text-on-image if any
- Do NOT use placeholder words like SHORT, TAGS, VOID, EXAMPLE

Description:
${description.trim()}`;
}

/** Flatten model tags: split commas, drop placeholders, dedupe. */
export function normalizeVisualTags(raw: unknown): string[] {
  const chunks: string[] = [];
  const push = (s: string) => {
    for (const part of s.split(/[,;|/]+/)) {
      const t = part.trim().replace(/\s+/g, "_").toUpperCase();
      if (!t || t.length > 60) continue;
      if (TAG_PLACEHOLDERS.has(t)) continue;
      if (/^ONE_SENTENCE/i.test(t)) continue;
      chunks.push(t);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) push(String(item));
  } else if (typeof raw === "string") {
    push(raw);
  }

  return [...new Set(chunks)].slice(0, 24);
}

/** Parse agent JSON; throws if caption is empty or a schema echo. */
export function parseVisionEnrichResult(raw: string): EnrichResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  let result: EnrichResult;
  try {
    const parsed = JSON.parse(slice) as {
      caption?: string;
      scenario?: string;
      tags?: unknown;
    };
    result = {
      aiCaption: (parsed.caption ?? "").toString().slice(0, 1000),
      aiScenario: (parsed.scenario ?? "").toString().slice(0, 1000),
      aiVisualTags: normalizeVisualTags(parsed.tags),
    };
  } catch {
    throw new Error("Agent enrich JSON parse failed");
  }
  const cap = result.aiCaption.trim();
  if (
    !cap ||
    /^void$/i.test(cap) ||
    /one sentence visual description/i.test(cap) ||
    /one concrete visual sentence/i.test(cap)
  ) {
    throw new Error("Vision caption empty or placeholder");
  }
  if (/^void$/i.test(result.aiScenario.trim())) {
    result.aiScenario = "";
  }
  return result;
}
