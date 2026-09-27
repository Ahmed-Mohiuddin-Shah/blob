import { isOllamaConfigured, ollamaChat } from "@/lib/ollama/client";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import { visionImageBase64 } from "@/lib/search/vision-image";
import {
  parseVisionEnrichResult,
  structureEnrichPrompt,
  VISION_DESCRIBE_PROMPT,
  type EnrichResult,
} from "@/lib/search/vision-parse";
import { getGlass } from "@/lib/glass";
import { MEDIA_ASSET_STATUS, MEDIA_KIND } from "@/lib/stickers";

export type { EnrichResult };

/** Still preview for vision — thumbnail first; never raw gif/video. */
export function pickSearchEnrichMedia<T extends { kind: string }>(
  media: T[],
): T | null {
  return (
    media.find((m) => m.kind === MEDIA_KIND.thumbnail) ||
    media.find((m) => m.kind === MEDIA_KIND.image) ||
    media.find((m) => m.kind === MEDIA_KIND.chat) ||
    null
  );
}

/** Download sticker preview, resize to JPEG base64 for Ollama vision. */
async function stickerPreviewBase64(stickerId: bigint): Promise<string | null> {
  const media = await prisma.mediaAsset.findMany({
    where: { stickerId, status: MEDIA_ASSET_STATUS.ready },
  });
  const asset = pickSearchEnrichMedia(media);
  if (!asset) return null;
  const glass = getGlass();
  const res = await glass.objects.download(asset.glassObjectId);
  const buf = Buffer.from(await res.arrayBuffer());
  return visionImageBase64(buf);
}

export async function runSearchEnrich(stickerId: bigint): Promise<EnrichResult> {
  if (!isOllamaConfigured()) {
    throw new Error("OLLAMA_BASE_URL is not set");
  }
  const visionModel = process.env.OLLAMA_VISION_MODEL?.trim() || "moondream";
  const agentModel = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const b64 = await stickerPreviewBase64(stickerId);
  if (!b64) throw new Error("No preview media for caption");

  const prose = (
    await ollamaChat({
      model: visionModel,
      prompt: VISION_DESCRIBE_PROMPT,
      images: [b64],
    })
  ).trim();
  if (!prose) throw new Error("Vision description empty");

  const structured = await ollamaChat({
    model: agentModel,
    prompt: structureEnrichPrompt(prose),
  });
  return parseVisionEnrichResult(structured);
}

/** Apply enrich result and move to pending_search_meta. */
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
