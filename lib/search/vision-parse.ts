import {
  DEFAULT_META_OUTPUT_EXAMPLE,
  DEFAULT_META_VISION_DESCRIBE,
  DEFAULT_META_VISION_MOTION,
  assembleStructurePrompt,
  assembleVisionJsonPrompt,
  defaultResolvedMetaPrompts,
  structurePromptFromResolved,
  visionJsonPromptFromResolved,
  type ResolvedMetaPrompts,
} from "@/lib/search/prompt-defaults";

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

const CAPTION_PLACEHOLDER =
  /^(void|<[^>]*>|\([^)]*\)|one sentence visual description|one concrete visual sentence|a character with|the mandela effect thing)/i;

type VisionPromptFamily = "moondream" | "qwen_vl" | "default";

/** Cached vision prompts — pick via OLLAMA_VISION_MODEL, no manual swaps. */
const VISION_DESCRIBE_PROMPTS: Record<VisionPromptFamily, string> = {
  moondream: "Describe this image for search:",
  qwen_vl: DEFAULT_META_VISION_DESCRIBE,
  default: "Describe this image for search:",
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

/** Pass 1 — image describe prompt (code default / family; prefer ResolvedMetaPrompts). */
export function visionDescribePrompt(
  model = process.env.OLLAMA_VISION_MODEL?.trim(),
): string {
  return VISION_DESCRIBE_PROMPTS[visionPromptFamily(model)];
}

export function visionMotionDescribePrompt(
  prompts?: ResolvedMetaPrompts,
): string {
  const body = prompts?.visionMotion?.trim();
  return body || DEFAULT_META_VISION_MOTION;
}

/**
 * @deprecated use visionDescribePrompt() — kept for tests / callers that expect a string const.
 * Resolves from env at module load; prefer the function so env changes apply.
 */
export const VISION_DESCRIBE_PROMPT = visionDescribePrompt();

/** Pass 2 — text agent turns prose into search meta JSON (code defaults). */
export function structureEnrichPrompt(description: string): string {
  const d = defaultResolvedMetaPrompts();
  return assembleStructurePrompt(d.structure, d.outputExample, description);
}

/** One-shot VL: image → JSON (code defaults). */
export function structureEnrichFromImagePrompt(
  _model = process.env.OLLAMA_VISION_MODEL?.trim(),
): string {
  const d = defaultResolvedMetaPrompts();
  return assembleVisionJsonPrompt(d.visionJson, d.outputExample);
}

export function describePromptFromResolved(
  prompts: ResolvedMetaPrompts,
  model?: string,
  opts?: { storyboard?: boolean },
): string {
  if (opts?.storyboard) return visionMotionDescribePrompt(prompts);
  // Admin override wins; else family-specific short moondream line.
  if (prompts.visionDescribe.trim()) return prompts.visionDescribe.trim();
  return visionDescribePrompt(model);
}

export {
  structurePromptFromResolved,
  visionJsonPromptFromResolved,
  DEFAULT_META_OUTPUT_EXAMPLE,
};

/** Strip markdown fences and extract a JSON object substring. */
export function extractJsonObject(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(s);
  if (fence?.[1]) s = fence[1].trim();
  else s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  // Common model junk: trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

/** Flatten model tags: split commas/spaces junk, drop placeholders, dedupe. */
export function normalizeVisualTags(raw: unknown): string[] {
  const chunks: string[] = [];
  const push = (s: string) => {
    for (const part of s.split(/[,;|/]+/)) {
      let t = part.trim().replace(/\s+/g, "_").toUpperCase();
      t = t.replace(/[()[\]{}<>]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
      if (!t || t.length > 60) continue;
      if (TAG_PLACEHOLDERS.has(t)) continue;
      if (/^ONE_SENTENCE/i.test(t)) continue;
      if (/^\d+$/.test(t)) continue; // storyboard frame numbers
      chunks.push(t);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object") continue;
      push(String(item));
    }
  } else if (typeof raw === "string") {
    push(raw);
  }

  return [...new Set(chunks)].slice(0, 24);
}

export function isSparseEnrich(result: EnrichResult): boolean {
  return result.aiVisualTags.length < 3 || !result.aiScenario.trim();
}

function isPlaceholderCaption(cap: string): boolean {
  const t = cap.trim();
  if (!t) return true;
  if (CAPTION_PLACEHOLDER.test(t)) return true;
  if (t.startsWith("<") && t.endsWith(">")) return true;
  if (/one concrete visual sentence/i.test(t)) return true;
  return false;
}

/** Parse agent JSON; throws if caption is empty or a schema echo. */
export function parseVisionEnrichResult(raw: string): EnrichResult {
  const slice = extractJsonObject(raw);
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
  if (isPlaceholderCaption(result.aiCaption)) {
    throw new Error("Vision caption empty or placeholder");
  }
  // Strip angle-bracket / paren wrappers models leave around real text
  result.aiCaption = result.aiCaption
    .replace(/^<|>$/g, "")
    .replace(/^\(|\)$/g, "")
    .trim()
    .slice(0, 1000);
  result.aiScenario = result.aiScenario
    .replace(/^<|>$/g, "")
    .replace(/^\(|\)$/g, "")
    .trim()
    .slice(0, 1000);
  if (/^void$/i.test(result.aiScenario)) {
    result.aiScenario = "";
  }
  return result;
}

/** Parse agent search plan JSON (q/mode/filter). */
export function parseSearchAgentPlan(
  raw: string,
  fallbackQ: string,
): { q: string; mode: "hybrid" | "semantic" | "keywords"; filter: string } {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as {
      q?: string;
      mode?: string;
      filter?: string;
    };
    const mode = (["hybrid", "semantic", "keywords"].includes(parsed.mode ?? "")
      ? parsed.mode
      : "hybrid") as "hybrid" | "semantic" | "keywords";
    return {
      q: parsed.q?.trim() || fallbackQ,
      mode,
      filter: parsed.filter?.trim() || "",
    };
  } catch {
    return { q: fallbackQ, mode: "hybrid", filter: "" };
  }
}
