import { isOllamaConfigured, ollamaChat } from "@/lib/ollama/client";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
import { getGlass } from "@/lib/glass";
import { MEDIA_ASSET_STATUS, MEDIA_KIND } from "@/lib/stickers";

export type EnrichResult = {
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
};

function parseVisionJson(raw: string): EnrichResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  let parsed: {
    caption?: string;
    scenario?: string;
    tags?: string[];
  } = {};
  try {
    parsed = JSON.parse(slice) as typeof parsed;
  } catch {
    return {
      aiCaption: raw.slice(0, 500),
      aiScenario: "",
      aiVisualTags: [],
    };
  }
  return {
    aiCaption: (parsed.caption ?? "").toString().slice(0, 1000),
    aiScenario: (parsed.scenario ?? "").toString().slice(0, 1000),
    aiVisualTags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).slice(0, 60)).slice(0, 24)
      : [],
  };
}

/** Download sticker preview bytes from GLASS as base64 for Ollama vision. */
async function stickerPreviewBase64(stickerId: bigint): Promise<string | null> {
  const media = await prisma.mediaAsset.findMany({
    where: { stickerId, status: MEDIA_ASSET_STATUS.ready },
  });
  const asset =
    media.find((m) => m.kind === MEDIA_KIND.thumbnail) ||
    media.find((m) => m.kind === MEDIA_KIND.image) ||
    media.find((m) => m.kind === MEDIA_KIND.chat) ||
    media.find((m) => m.kind === MEDIA_KIND.gif);
  if (!asset) return null;
  const glass = getGlass();
  const res = await glass.objects.download(asset.glassObjectId);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

export async function runSearchEnrich(stickerId: bigint): Promise<EnrichResult> {
  if (!isOllamaConfigured()) {
    throw new Error("OLLAMA_BASE_URL is not set");
  }
  const model = process.env.OLLAMA_VISION_MODEL?.trim() || "moondream";
  const b64 = await stickerPreviewBase64(stickerId);
  if (!b64) throw new Error("No preview media for caption");

  const prompt = `Describe this sticker for search. Reply with ONLY JSON:
{"caption":"one sentence visual description","scenario":"when someone would use this sticker","tags":["SHORT","TAGS"]}`;

  const raw = await ollamaChat({
    model,
    prompt,
    images: [b64],
  });
  return parseVisionJson(raw);
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
