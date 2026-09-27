export type EnrichResult = {
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
};

/** Parse Ollama vision JSON; throws if caption is empty or a schema echo. */
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
    result = {
      aiCaption: raw.slice(0, 500),
      aiScenario: "",
      aiVisualTags: [],
    };
  }
  const cap = result.aiCaption.trim();
  if (!cap || /one sentence visual description/i.test(cap)) {
    throw new Error("Vision caption empty or placeholder");
  }
  return result;
}
