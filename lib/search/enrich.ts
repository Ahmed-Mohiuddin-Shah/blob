import {
  isOllamaConfigured,
  isOllamaRepeatLimitError,
  ollamaChat,
  ollamaChatOptions,
} from "@/lib/ollama/client";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import {
  isVisionImageMime,
  visionImageBase64,
} from "@/lib/search/vision-image";
import {
  isSparseEnrich,
  parseVisionEnrichResult,
  structureEnrichFromImagePrompt,
  structureEnrichPrompt,
  visionDescribePrompt,
  type EnrichResult,
} from "@/lib/search/vision-parse";
import { getGlass } from "@/lib/glass";
import { MEDIA_ASSET_STATUS, MEDIA_KIND } from "@/lib/stickers";

export type { EnrichResult };

const STILL_KIND_ORDER = [
  MEDIA_KIND.thumbnail,
  MEDIA_KIND.image,
  MEDIA_KIND.chat,
] as const;

/** Still preview for vision — image mime only; never raw mp4/video. */
export function pickSearchEnrichMedia<
  T extends { kind: string; mimeType?: string | null },
>(media: T[]): T | null {
  for (const kind of STILL_KIND_ORDER) {
    const hit = media.find(
      (m) => m.kind === kind && isVisionImageMime(m.mimeType),
    );
    if (hit) return hit;
  }
  for (const kind of STILL_KIND_ORDER) {
    const hit = media.find(
      (m) =>
        m.kind === kind &&
        (m.mimeType == null || !String(m.mimeType).startsWith("video/")),
    );
    if (hit) return hit;
  }
  return null;
}

/** Ordered still candidates for vision (image mime preferred). */
export function searchEnrichMediaCandidates<
  T extends { kind: string; mimeType?: string | null },
>(media: T[]): T[] {
  const out: T[] = [];
  for (const kind of STILL_KIND_ORDER) {
    for (const m of media) {
      if (m.kind !== kind) continue;
      if (m.mimeType != null && !isVisionImageMime(m.mimeType)) continue;
      out.push(m);
    }
  }
  return out;
}

async function stickerPreviewBase64(stickerId: bigint): Promise<string | null> {
  const media = await prisma.mediaAsset.findMany({
    where: { stickerId, status: MEDIA_ASSET_STATUS.ready },
  });
  const candidates = searchEnrichMediaCandidates(media);
  if (candidates.length === 0) {
    if (media.some((m) => String(m.mimeType).startsWith("video/"))) {
      throw new Error(
        "No still image for vision (video-only sticker — re-encode stills)",
      );
    }
    return null;
  }
  const glass = getGlass();
  let lastErr: unknown;
  for (const asset of candidates) {
    try {
      const res = await glass.objects.download(asset.glassObjectId);
      const buf = Buffer.from(await res.arrayBuffer());
      return await visionImageBase64(buf);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Vision image decode failed for all candidates");
}

async function chatSafe(
  input: Parameters<typeof ollamaChat>[0],
): Promise<string | null> {
  try {
    return await ollamaChat(input);
  } catch (err) {
    // Repeat-loop abort → try next enrich strategy instead of failing the job.
    if (isOllamaRepeatLimitError(err)) return null;
    throw err;
  }
}

async function visionProse(
  visionModel: string,
  b64: string,
): Promise<string> {
  const once = () =>
    chatSafe({
      model: visionModel,
      prompt: visionDescribePrompt(visionModel),
      images: [b64],
      options: ollamaChatOptions("describe"),
    });
  let prose = ((await once()) ?? "").trim();
  if (!prose) prose = ((await once()) ?? "").trim();
  return prose;
}

function tryParse(raw: string | null): EnrichResult | null {
  if (!raw) return null;
  try {
    return parseVisionEnrichResult(raw);
  } catch {
    return null;
  }
}

/**
 * Vision prose → text agent JSON; if tags/scenario missing, retry agent then
 * one-shot VL JSON from the image (qwen2.5vl etc.).
 */
export async function runSearchEnrich(stickerId: bigint): Promise<EnrichResult> {
  if (!isOllamaConfigured()) {
    throw new Error("OLLAMA_BASE_URL is not set");
  }
  const visionModel = process.env.OLLAMA_VISION_MODEL?.trim() || "moondream";
  const agentModel = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const b64 = await stickerPreviewBase64(stickerId);
  if (!b64) throw new Error("No preview media for caption");

  const prose = await visionProse(visionModel, b64);
  if (!prose) {
    throw new Error(
      `Vision description empty (${visionModel}) — check Ollama vision model`,
    );
  }

  const jsonOpts = ollamaChatOptions("json");
  let result = tryParse(
    await chatSafe({
      model: agentModel,
      prompt: structureEnrichPrompt(prose),
      options: jsonOpts,
    }),
  );

  if (!result || isSparseEnrich(result)) {
    result = tryParse(
      await chatSafe({
        model: agentModel,
        prompt: `${structureEnrichPrompt(prose)}\n\nYour previous reply was missing scenario or tags. Fill ALL three fields.`,
        options: jsonOpts,
      }),
    );
  }

  if (!result || isSparseEnrich(result)) {
    // VL models (qwen2.5vl) can emit JSON from the image directly.
    result = tryParse(
      await chatSafe({
        model: visionModel,
        prompt: structureEnrichFromImagePrompt(visionModel),
        images: [b64],
        options: jsonOpts,
      }),
    );
  }

  if (result && !isSparseEnrich(result)) return result;

  // Last resort: keep caption/scenario from best attempt; never ship empty tags silently.
  if (result) {
    if (!result.aiScenario.trim()) {
      result.aiScenario = "Reaction sticker in chat";
    }
    if (result.aiVisualTags.length < 3) {
      result.aiVisualTags = [
        ...result.aiVisualTags,
        "STICKER",
        "MEME",
        "REACTION",
      ].filter((t, i, a) => a.indexOf(t) === i);
    }
    return result;
  }

  return {
    aiCaption: prose.slice(0, 1000),
    aiScenario: "Reaction sticker in chat",
    aiVisualTags: ["STICKER", "MEME", "REACTION"],
  };
}

export async function applySearchEnrichResult(
  stickerId: bigint,
  result: EnrichResult,
): Promise<void> {
  await prisma.sticker.update({
    where: { id: stickerId },
    data: {
      aiCaption: result.aiCaption,
      aiScenario: result.aiScenario,
      aiVisualTags: JSON.stringify(result.aiVisualTags),
      searchMetaStatus: SEARCH_META_STATUS.pendingSearchMeta,
    },
  });
}

export async function processSearchEnrichLocal(stickerId: bigint): Promise<void> {
  await prisma.sticker.update({
    where: { id: stickerId },
    data: { searchMetaStatus: SEARCH_META_STATUS.enriching },
  });
  try {
    const result = await runSearchEnrich(stickerId);
    await applySearchEnrichResult(stickerId, result);
  } catch (err) {
    await prisma.sticker.update({
      where: { id: stickerId },
      data: { searchMetaStatus: SEARCH_META_STATUS.none },
    });
    throw err;
  }
}
