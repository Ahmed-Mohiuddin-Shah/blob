export type EnrichResult = {
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
};

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

const JSON_SCHEMA_HINT = `{"caption":"<one concrete visual sentence>","scenario":"<when someone would send this sticker>","tags":["ANIME","ANGRY","MEME","TEXT"]}`;

type VisionPromptFamily = "moondream" | "qwen_vl" | "default";

/** Cached vision prompts — pick via OLLAMA_VISION_MODEL, no manual swaps. */
const VISION_DESCRIBE_PROMPTS: Record<VisionPromptFamily, string> = {
  moondream: "Describe this image for search:",
  qwen_vl:
    "Describe this sticker for search in 2-4 sentences: subjects, text on image, emotion, and style.",
  default: "Describe this image for search:",
};

const VISION_JSON_FROM_IMAGE_PROMPTS: Record<VisionPromptFamily, string> = {
  moondream: `Look at this sticker. Reply with ONLY JSON (no markdown):
${JSON_SCHEMA_HINT}

Requirements: caption (one sentence), scenario (when to send), tags (5-12 separate short words). No SHORT/TAGS/VOID.`,
  qwen_vl: `Look at this sticker image. Reply with ONLY JSON (no markdown):
${JSON_SCHEMA_HINT}

Requirements (all required):
- caption: one concrete visual sentence
- scenario: when someone would send this sticker
- tags: 5 to 12 separate short tags in the array (no commas inside a tag)
- Specific: character, emotion, objects, style, text-on-image if any
- Do NOT use SHORT, TAGS, VOID, or EXAMPLE`,
  default: `Look at this sticker image. Reply with ONLY JSON (no markdown):
${JSON_SCHEMA_HINT}

Requirements (all required):
- caption: one concrete visual sentence
- scenario: when someone would send this sticker
- tags: 5 to 12 separate short tags in the array (no commas inside a tag)
- Do NOT use SHORT, TAGS, VOID, or EXAMPLE`,
};

export function visionPromptFamily(
  model = process.env.OLLAMA_VISION_MODEL?.trim() || "",
): VisionPromptFamily {
  const m = model.toLowerCase();
  if (m.includes("moondream")) return "moondream";
  if (m.includes("qwen") && (m.includes("vl") || m.includes("vision"))) {
    return "qwen_vl";
  }
  if (m.includes("qwen2.5vl") || m.includes("qwen2.5-vl")) return "qwen_vl";
  return "default";
}

/** Pass 1 — image describe prompt for the configured vision model. */
export function visionDescribePrompt(
  model = process.env.OLLAMA_VISION_MODEL?.trim(),
): string {
  return VISION_DESCRIBE_PROMPTS[visionPromptFamily(model)];
}

/**
 * @deprecated use visionDescribePrompt() — kept for tests / callers that expect a string const.
 * Resolves from env at module load; prefer the function so env changes apply.
 */
export const VISION_DESCRIBE_PROMPT = visionDescribePrompt();

/** Pass 2 — text agent turns prose into search meta JSON (model-agnostic). */
export function structureEnrichPrompt(description: string): string {
  return `Given this sticker description, reply with ONLY JSON (no markdown):
${JSON_SCHEMA_HINT}

Requirements (all required):
- caption: one concrete visual sentence (not empty)
- scenario: when someone would send this sticker (not empty)
- tags: 5 to 12 SEPARATE array strings (one word or underscore_phrase each; NEVER put commas inside a tag)
- Specific visuals: character, emotion, objects, style, text-on-image if any
- Do NOT use placeholder words like SHORT, TAGS, VOID, EXAMPLE

Description:
${description.trim()}`;
}

/** One-shot VL: image → JSON — prompt cached per vision model family. */
export function structureEnrichFromImagePrompt(
  model = process.env.OLLAMA_VISION_MODEL?.trim(),
): string {
  return VISION_JSON_FROM_IMAGE_PROMPTS[visionPromptFamily(model)];
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

export function isSparseEnrich(result: EnrichResult): boolean {
  return result.aiVisualTags.length < 3 || !result.aiScenario.trim();
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
