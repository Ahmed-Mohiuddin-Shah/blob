/** Draft AI meta shape stored in sticker.aiMetaDraft (JSON). */

export type AiMetaDraft = {
  caption: string;
  scenario: string;
  tags: string[];
  updatedAt: string;
};

export function parseAiMetaDraft(raw: unknown): AiMetaDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const caption = typeof o.caption === "string" ? o.caption : "";
  const scenario = typeof o.scenario === "string" ? o.scenario : "";
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string")
    : [];
  if (!caption.trim() && !scenario.trim() && tags.length === 0) return null;
  return {
    caption,
    scenario,
    tags,
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export function draftFromEnrich(result: {
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
}): AiMetaDraft {
  return {
    caption: result.aiCaption,
    scenario: result.aiScenario,
    tags: result.aiVisualTags,
    updatedAt: new Date().toISOString(),
  };
}

export function hasLiveMeta(sticker: {
  aiCaption?: string | null;
  aiScenario?: string | null;
  aiVisualTags?: string | null;
}): boolean {
  if (sticker.aiCaption?.trim()) return true;
  if (sticker.aiScenario?.trim()) return true;
  if (!sticker.aiVisualTags) return false;
  try {
    const tags = JSON.parse(sticker.aiVisualTags) as unknown;
    return Array.isArray(tags) && tags.length > 0;
  } catch {
    return false;
  }
}
