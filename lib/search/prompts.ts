import { prisma } from "@/lib/prisma";
import {
  defaultResolvedMetaPrompts,
  defaultResolvedSearchPrompts,
  LLM_PROMPT_DEFAULTS,
  LLM_PROMPT_KEY,
  type LlmPromptKey,
  type ResolvedMetaPrompts,
  type ResolvedSearchPrompts,
} from "@/lib/search/prompt-defaults";

export {
  assembleSearchAgentPrompt,
  assembleStructurePrompt,
  assembleVisionJsonPrompt,
  defaultResolvedMetaPrompts,
  defaultResolvedSearchPrompts,
  LLM_PROMPT_DEFAULTS,
  LLM_PROMPT_KEY,
  searchAgentPromptFromResolved,
  structurePromptFromResolved,
  visionJsonPromptFromResolved,
  type LlmPromptKey,
  type ResolvedMetaPrompts,
  type ResolvedSearchPrompts,
} from "@/lib/search/prompt-defaults";

/** Load one prompt body (DB override or code default). */
export async function getLlmPrompt(key: LlmPromptKey): Promise<string> {
  const row = await prisma.llmPrompt.findUnique({ where: { key } });
  const body = row?.body?.trim();
  if (body) return body;
  return LLM_PROMPT_DEFAULTS[key];
}

/** Current values for admin forms (DB or defaults). */
export async function loadPromptFormBodies(): Promise<Record<LlmPromptKey, string>> {
  const rows = await prisma.llmPrompt.findMany();
  const map = new Map(rows.map((r) => [r.key, r.body]));
  const out = { ...LLM_PROMPT_DEFAULTS };
  for (const key of Object.values(LLM_PROMPT_KEY)) {
    const body = map.get(key)?.trim();
    if (body) out[key] = body;
  }
  return out;
}

export async function getResolvedMetaPrompts(): Promise<ResolvedMetaPrompts> {
  const [
    visionDescribe,
    visionMotion,
    structure,
    visionJson,
    outputExample,
  ] = await Promise.all([
    getLlmPrompt(LLM_PROMPT_KEY.metaVisionDescribe),
    getLlmPrompt(LLM_PROMPT_KEY.metaVisionMotion),
    getLlmPrompt(LLM_PROMPT_KEY.metaStructure),
    getLlmPrompt(LLM_PROMPT_KEY.metaVisionJson),
    getLlmPrompt(LLM_PROMPT_KEY.metaOutputExample),
  ]);
  return { visionDescribe, visionMotion, structure, visionJson, outputExample };
}

export async function getResolvedSearchPrompts(): Promise<ResolvedSearchPrompts> {
  const [agent, outputExample] = await Promise.all([
    getLlmPrompt(LLM_PROMPT_KEY.searchAgent),
    getLlmPrompt(LLM_PROMPT_KEY.searchOutputExample),
  ]);
  return { agent, outputExample };
}

export async function upsertLlmPrompts(
  updates: Partial<Record<LlmPromptKey, string>>,
  updatedById: bigint | null,
): Promise<void> {
  const entries = Object.entries(updates).filter(
    (e): e is [LlmPromptKey, string] =>
      e[0] in LLM_PROMPT_DEFAULTS && typeof e[1] === "string",
  );
  for (const [key, body] of entries) {
    const trimmed = body.trim();
    if (!trimmed) continue;
    await prisma.llmPrompt.upsert({
      where: { key },
      create: { key, body: trimmed, updatedById },
      update: { body: trimmed, updatedById },
    });
  }
}

/** Draft pack from form fields (unsaved test). */
export function metaPromptsFromDraft(draft: {
  visionDescribe: string;
  visionMotion?: string;
  structure: string;
  visionJson: string;
  outputExample: string;
}): ResolvedMetaPrompts {
  const d = defaultResolvedMetaPrompts();
  return {
    visionDescribe: draft.visionDescribe.trim() || d.visionDescribe,
    visionMotion: draft.visionMotion?.trim() || d.visionMotion,
    structure: draft.structure.trim() || d.structure,
    visionJson: draft.visionJson.trim() || d.visionJson,
    outputExample: draft.outputExample.trim() || d.outputExample,
  };
}

export function searchPromptsFromDraft(draft: {
  agent: string;
  outputExample: string;
}): ResolvedSearchPrompts {
  const d = defaultResolvedSearchPrompts();
  return {
    agent: draft.agent.trim() || d.agent,
    outputExample: draft.outputExample.trim() || d.outputExample,
  };
}
