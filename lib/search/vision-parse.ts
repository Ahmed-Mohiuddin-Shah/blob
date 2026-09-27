export type EnrichResult = {
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
};

/** Pass 1 — moondream (image + this prompt only). */
export const VISION_DESCRIBE_PROMPT = "Describe this image for search:";

/** Pass 2 — text model turns prose into search meta JSON. */
export function structureEnrichPrompt(description: string): string {
  return `Given this sticker description, reply with ONLY JSON:
{"caption":"one sentence visual description","scenario":"when someone would use this sticker","tags":["SHORT","TAGS"]}

Description:
${description.trim()}`;
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
      tags?: string[];
    };
    result = {
      aiCaption: (parsed.caption ?? "").toString().slice(0, 1000),
      aiScenario: (parsed.scenario ?? "").toString().slice(0, 1000),
      aiVisualTags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).slice(0, 60)).slice(0, 24)
        : [],
    };
  } catch {
    throw new Error("Agent enrich JSON parse failed");
  }
  const cap = result.aiCaption.trim();
  if (!cap || /one sentence visual description/i.test(cap)) {
    throw new Error("Vision caption empty or placeholder");
  }
  return result;
}
