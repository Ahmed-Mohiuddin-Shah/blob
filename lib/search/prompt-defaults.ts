/**
 * Code defaults + assemblers for LLM prompts (no Prisma — safe for workers).
 * Dynamic slots are injected here; admins never invent placeholder syntax.
 */

export const LLM_PROMPT_KEY = {
  metaVisionDescribe: "meta_vision_describe",
  metaStructure: "meta_structure",
  metaVisionJson: "meta_vision_json",
  metaOutputExample: "meta_output_example",
  searchAgent: "search_agent",
  searchOutputExample: "search_output_example",
} as const;

export type LlmPromptKey =
  (typeof LLM_PROMPT_KEY)[keyof typeof LLM_PROMPT_KEY];

/** Neutral example tags — avoid ANIME/ANGRY/MEME echo loops. */
export const DEFAULT_META_OUTPUT_EXAMPLE = `{"caption":"<one concrete visual sentence>","scenario":"<when someone would send this sticker>","tags":["CHARACTER","EMOTION","OBJECT","STYLE"]}`;

export const DEFAULT_SEARCH_OUTPUT_EXAMPLE = `{"q":"rewritten keyword/semantic query","mode":"hybrid"|"semantic"|"keywords","filter":"optional meilisearch filter or empty string"}`;

export const DEFAULT_META_VISION_DESCRIBE =
  "Describe this sticker for search in 2-4 sentences: subjects, text on image, emotion, and style.";

export const DEFAULT_META_STRUCTURE = `Given this sticker description, reply with ONLY JSON (no markdown).

Requirements (all required):
- caption: one concrete visual sentence (not empty)
- scenario: when someone would send this sticker (not empty)
- tags: 5 to 12 SEPARATE array strings (one word or underscore_phrase each; NEVER put commas inside a tag)
- Specific visuals: character, emotion, objects, style, text-on-image if any
- Do NOT use placeholder words like SHORT, TAGS, VOID, EXAMPLE
- Prefer concrete tags from the image; do not copy example tag names when they do not fit`;

export const DEFAULT_META_VISION_JSON = `Look at this sticker image. Reply with ONLY JSON (no markdown).

Requirements (all required):
- caption: one concrete visual sentence
- scenario: when someone would send this sticker
- tags: 5 to 12 separate short tags in the array (no commas inside a tag)
- Specific: character, emotion, objects, style, text-on-image if any
- Do NOT use SHORT, TAGS, VOID, EXAMPLE
- Prefer concrete tags from the image; do not copy example tag names when they do not fit`;

export const DEFAULT_SEARCH_AGENT = `You help search a sticker site. Given the user query, reply with ONLY JSON.`;

export const LLM_PROMPT_DEFAULTS: Record<LlmPromptKey, string> = {
  [LLM_PROMPT_KEY.metaVisionDescribe]: DEFAULT_META_VISION_DESCRIBE,
  [LLM_PROMPT_KEY.metaStructure]: DEFAULT_META_STRUCTURE,
  [LLM_PROMPT_KEY.metaVisionJson]: DEFAULT_META_VISION_JSON,
  [LLM_PROMPT_KEY.metaOutputExample]: DEFAULT_META_OUTPUT_EXAMPLE,
  [LLM_PROMPT_KEY.searchAgent]: DEFAULT_SEARCH_AGENT,
  [LLM_PROMPT_KEY.searchOutputExample]: DEFAULT_SEARCH_OUTPUT_EXAMPLE,
};

export type ResolvedMetaPrompts = {
  visionDescribe: string;
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

${outputExample.trim()}`;
}

/** Assemble search-agent planner prompt. */
export function assembleSearchAgentPrompt(
  instructions: string,
  outputExample: string,
  query: string,
): string {
  return `${instructions.trim()}
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
): string {
  return assembleVisionJsonPrompt(prompts.visionJson, prompts.outputExample);
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
