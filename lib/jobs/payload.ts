import { getPublicPrismId } from "@/lib/glass";
import {
  type CompositionJobPayload,
  type JobPayload,
  type PackJobPayload,
  type SearchEnrichJobPayload,
  type SheetJobPayload,
} from "@/lib/jobs/payload-types";
import { JOB_TYPE, type JobType } from "@/lib/jobs/types";
import { prisma } from "@/lib/prisma";
import {
  maxDurationMsForKind,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  primaryMediaKind,
} from "@/lib/stickers";

export type {
  CompositionJobPayload,
  JobPayload,
  PackJobPayload,
  SearchEnrichJobPayload,
  SheetJobPayload,
} from "@/lib/jobs/payload-types";

export async function buildJobPayload(
  type: JobType,
  subjectId: bigint,
): Promise<JobPayload> {
  if (type === JOB_TYPE.compositionEncode) {
    return buildCompositionPayload(subjectId);
  }
  if (type === JOB_TYPE.sheetEncode) {
    return buildSheetPayload(subjectId);
  }
  if (type === JOB_TYPE.searchEnrich) {
    return buildSearchEnrichPayload(subjectId);
  }
  return buildPackPayload(subjectId);
}

async function buildSearchEnrichPayload(
  stickerId: bigint,
): Promise<SearchEnrichJobPayload> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: { media: true },
  });
  if (!sticker) throw new Error("Missing sticker");
  const media = sticker.media.filter((m) => m.status === MEDIA_ASSET_STATUS.ready);
  const asset =
    media.find((m) => m.kind === MEDIA_KIND.thumbnail) ||
    media.find((m) => m.kind === MEDIA_KIND.image) ||
    media.find((m) => m.kind === MEDIA_KIND.chat) ||
    media.find((m) => m.kind === MEDIA_KIND.gif);
  if (!asset) throw new Error("No preview media for search_enrich");
  return {
    kind: JOB_TYPE.searchEnrich,
    stickerId: sticker.id.toString(),
    slug: sticker.slug,
    title: sticker.title,
    glassObjectId: asset.glassObjectId,
    mimeType: asset.mimeType,
  };
}

async function buildCompositionPayload(
  stickerId: bigint,
): Promise<CompositionJobPayload> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: {
      composition: {
        include: {
          revisions: { orderBy: { revision: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!sticker?.composition) {
    throw new Error("Missing composition");
  }
  const comp = sticker.composition;
  const revision =
    comp.revisions[0] ??
    (comp.currentRevisionId
      ? await prisma.compositionRevision.findUnique({
          where: { id: comp.currentRevisionId },
        })
      : null);
  if (!revision) throw new Error("Missing composition revision");

  const doc = revision.documentJson as { objects?: Array<{ type?: string; asset_id?: string; mask_asset_id?: string }> };
  const assetIdSet = new Set<string>();
  for (const o of doc.objects ?? []) {
    if (o.type === "media" && o.asset_id && /^\d+$/.test(o.asset_id)) {
      assetIdSet.add(o.asset_id);
      if (o.mask_asset_id && /^\d+$/.test(o.mask_asset_id)) {
        assetIdSet.add(o.mask_asset_id);
      }
    }
  }
  const assetIds = [...assetIdSet].map((id) => BigInt(id));
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds } } })
    : [];

  const prismId =
    assets[0]?.glassPrismId ??
    (
      await prisma.mediaAsset.findFirst({
        where: { stickerId },
        select: { glassPrismId: true },
      })
    )?.glassPrismId ??
    null;

  const maxDurationMs = maxDurationMsForKind(
    primaryMediaKind(revision.documentJson),
  );

  return {
    kind: JOB_TYPE.compositionEncode,
    stickerId: stickerId.toString(),
    slug: sticker.slug,
    title: sticker.title,
    revisionId: revision.id.toString(),
    documentJson: revision.documentJson,
    maxDurationMs: maxDurationMs ?? null,
    prismId,
    assets: assets.map((a) => ({
      id: a.id.toString(),
      glassObjectId: a.glassObjectId,
      mimeType: a.mimeType,
    })),
  };
}

async function buildSheetPayload(sheetId: bigint): Promise<SheetJobPayload> {
  const sheet = await prisma.stickerSheet.findUnique({
    where: { id: sheetId },
    include: { stickers: { orderBy: { sortOrder: "asc" } } },
  });
  if (!sheet) throw new Error("Missing sheet");

  const stickerIds = sheet.stickers.map((s) => s.stickerId);
  const media = await prisma.mediaAsset.findMany({
    where: {
      stickerId: { in: stickerIds },
      kind: MEDIA_KIND.image,
      status: MEDIA_ASSET_STATUS.ready,
    },
  });

  return {
    kind: JOB_TYPE.sheetEncode,
    sheetId: sheetId.toString(),
    slug: sheet.slug,
    name: sheet.name,
    printDocumentJson: sheet.printDocumentJson,
    prismId: await getPublicPrismId(),
    stickers: media.map((m) => ({
      stickerId: m.stickerId.toString(),
      glassObjectId: m.glassObjectId,
      mimeType: m.mimeType,
    })),
  };
}

async function buildPackPayload(packId: bigint): Promise<PackJobPayload> {
  const pack = await prisma.stickerPack.findUnique({
    where: { id: packId },
    include: {
      sheets: {
        orderBy: { sortOrder: "asc" },
        include: { sheet: true },
      },
    },
  });
  if (!pack) throw new Error("Missing pack");

  return {
    kind: JOB_TYPE.packEncode,
    packId: packId.toString(),
    slug: pack.slug,
    name: pack.name,
    prismId: await getPublicPrismId(),
    sheets: pack.sheets.map((ps) => ({
      sheetId: ps.sheet.id.toString(),
      status: ps.sheet.status,
      pngGlassObjectId: ps.sheet.pngGlassObjectId,
      pdfGlassObjectId: ps.sheet.pdfGlassObjectId,
    })),
  };
}
