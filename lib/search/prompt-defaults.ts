/**
 * Code defaults + assemblers for LLM prompts (no Prisma — safe for workers).
 * Dynamic slots are injected here; admins never invent placeholder syntax.
 */

export const LLM_PROMPT_KEY = {
  metaVisionDescribe: "meta_vision_describe",
  metaVisionMotion: "meta_vision_motion",
  metaStructure: "meta_structure",
  metaVisionJson: "meta_vision_json",
  metaOutputExample: "meta_output_example",
  searchAgent: "search_agent",
  searchOutputExample: "search_output_example",
} as const;

export type LlmPromptKey =
  (typeof LLM_PROMPT_KEY)[keyof typeof LLM_PROMPT_KEY];

/**
 * Concrete example only — no angle brackets / schema placeholders models echo.
 * Escape as a single JSON line after a Schema: block in assemblers.
 */
export const DEFAULT_META_OUTPUT_EXAMPLE = `{"caption":"Chibi girl with round glasses sticks tongue out under a bunch of colorful balloons","scenario":"Celebrate a birthday or share silly happy energy in chat","tags":["CHIBI_GIRL","GLASSES","BALLOONS","HAPPY","TONGUE_OUT","CELEBRATION"]}`;

export const DEFAULT_SEARCH_OUTPUT_EXAMPLE = `{"q":"happy birthday balloons sticker","mode":"hybrid","filter":""}`;

export const DEFAULT_META_VISION_DESCRIBE =
  "Describe this sticker for search in 2-4 sentences: subjects, text on image, emotion, and style.";

/** 6-frame storyboard — corner digits are sequence markers, not content. */
export const DEFAULT_META_VISION_MOTION = `This image is a 2x3 storyboard of six frames from a GIF or video, in time order.

IMPORTANT: The small numbers 1-6 in the corners are frame sequence markers only. They are NOT part of the sticker art, text, or objects. Never mention them in your description, and never use them as tags.

Describe what is happening across the timeline in 2-4 sentences for search: subjects, motion/action, on-screen text if any, emotion, and style.`;

export const DEFAULT_META_STRUCTURE = `Given this sticker description, reply with ONLY a single JSON object. No markdown fences, no prose before or after.

Schema (all required):
- caption: string — one concrete visual sentence grounded in the description
- scenario: string — when someone would send this sticker
- tags: string[] — 5 to 12 items; each tag is ONE_WORD or underscore_phrase; UPPERCASE preferred; no spaces, commas, or parentheses inside a tag

Rules:
- Do not copy example wording unless it truly fits
- Do not use placeholder tokens (VOID, EXAMPLE, SHORT, TAGS, CHARACTER, EMOTION, OBJECT, STYLE as generic fillers)
- Prefer concrete visuals from the description`;

export const DEFAULT_META_VISION_JSON = `Look at this sticker image. Reply with ONLY a single JSON object. No markdown fences, no prose before or after.

If this image is a numbered 2x3 storyboard: corner digits 1-6 are sequence markers only — ignore them as content; describe the animation/action across frames.

Schema (all required):
- caption: string — one concrete visual sentence
- scenario: string — when someone would send this sticker
- tags: string[] — 5 to 12 short tags (underscore_phrase OK; no spaces/commas inside a tag)

Do not echo example captions or filler tags.`;

export const DEFAULT_SEARCH_AGENT = `You help users search a sticker site. Use the provided tools to learn allowed search modes and filter fields, then search. Prefer hybrid mode unless the user clearly wants keywords-only or pure semantic. Reply briefly when done.`;

export const LLM_PROMPT_DEFAULTS: Record<LlmPromptKey, string> = {
  [LLM_PROMPT_KEY.metaVisionDescribe]: DEFAULT_META_VISION_DESCRIBE,
  [LLM_PROMPT_KEY.metaVisionMotion]: DEFAULT_META_VISION_MOTION,
  [LLM_PROMPT_KEY.metaStructure]: DEFAULT_META_STRUCTURE,
  [LLM_PROMPT_KEY.metaVisionJson]: DEFAULT_META_VISION_JSON,
  [LLM_PROMPT_KEY.metaOutputExample]: DEFAULT_META_OUTPUT_EXAMPLE,
  [LLM_PROMPT_KEY.searchAgent]: DEFAULT_SEARCH_AGENT,
  [LLM_PROMPT_KEY.searchOutputExample]: DEFAULT_SEARCH_OUTPUT_EXAMPLE,
};

export type ResolvedMetaPrompts = {
  visionDescribe: string;
  visionMotion: string;
  structure: string;
  visionJson: string;
  outputExample: string;
};

export type ResolvedSearchPrompts = {
  agent: string;
  outputExample: string;
};

/** Assemble structure-from-prose prompt (injects description + output example). */
export function assembleStructurePrompt(
  instructions: string,
  outputExample: string,
  description: string,
): string {
  return `${instructions.trim()}

Example JSON (shape only — invent values from the description):
${outputExample.trim()}

Description:
${description.trim()}`;
}

/** Assemble one-shot VL JSON prompt. */
export function assembleVisionJsonPrompt(
  instructions: string,
  outputExample: string,
): string {
  return `${instructions.trim()}

Example JSON (shape only — invent values from the image):
${outputExample.trim()}`;
}

/** Assemble search-agent planner prompt (legacy single-shot / fallback). */
export function assembleSearchAgentPrompt(
  instructions: string,
  outputExample: string,
  query: string,
): string {
  return `${instructions.trim()}

If you cannot use tools, reply with ONLY JSON matching:
${outputExample.trim()}

User query: ${query.trim()}`;
}

/** Build final structure prompt from a resolved meta pack. */
export function structurePromptFromResolved(
  prompts: ResolvedMetaPrompts,
  description: string,
): string {
  return assembleStructurePrompt(
    prompts.structure,
    prompts.outputExample,
    description,
  );
}

export function visionJsonPromptFromResolved(
  prompts: ResolvedMetaPrompts,
  opts?: { storyboard?: boolean },
): string {
  const base = assembleVisionJsonPrompt(prompts.visionJson, prompts.outputExample);
  if (!opts?.storyboard) return base;
  return `${base}

Reminder: corner numbers 1-6 on a storyboard are sequence markers only — not sticker content.`;
}

export function searchAgentPromptFromResolved(
  prompts: ResolvedSearchPrompts,
  query: string,
): string {
  return assembleSearchAgentPrompt(
    prompts.agent,
    prompts.outputExample,
    query,
  );
}

export function defaultResolvedMetaPrompts(): ResolvedMetaPrompts {
  return {
    visionDescribe: DEFAULT_META_VISION_DESCRIBE,
    visionMotion: DEFAULT_META_VISION_MOTION,
    structure: DEFAULT_META_STRUCTURE,
    visionJson: DEFAULT_META_VISION_JSON,
    outputExample: DEFAULT_META_OUTPUT_EXAMPLE,
  };
}

export function defaultResolvedSearchPrompts(): ResolvedSearchPrompts {
  return {
    agent: DEFAULT_SEARCH_AGENT,
    outputExample: DEFAULT_SEARCH_OUTPUT_EXAMPLE,
  };
}
