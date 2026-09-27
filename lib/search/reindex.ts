import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { MODERATION_STATUS } from "@/lib/moderation";
import {
  PROCESSING_STATUS,
  VISIBILITY,
} from "@/lib/stickers";
import {
  upsertBlobberSearch,
  upsertCollectionSearch,
  upsertPrintSearch,
  upsertStickerSearch,
} from "@/lib/search/sync";

export type ReindexResult = {
  stickers: number;
  collections: number;
  sheets: number;
  packs: number;
  blobbers: number;
  errors: number;
};

const BATCH = 40;

/** Catalog reindex into Meili — no AI enrich; indexes approved public ready docs. */
export async function reindexCatalogSearch(): Promise<ReindexResult> {
  const result: ReindexResult = {
    stickers: 0,
    collections: 0,
    sheets: 0,
    packs: 0,
    blobbers: 0,
    errors: 0,
  };

  let stickerCursor: bigint | undefined;
  for (;;) {
    const batch = await prisma.sticker.findMany({
      where: {
        moderationStatus: MODERATION_STATUS.approved,
        visibility: VISIBILITY.public,
        processingStatus: PROCESSING_STATUS.ready,
        ...(stickerCursor ? { id: { gt: stickerCursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true },
    });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        await upsertStickerSearch(row.id, { requireSearchMeta: false });
        result.stickers += 1;
      } catch {
        result.errors += 1;
      }
    }
    stickerCursor = batch[batch.length - 1]!.id;
  }

  let collectionCursor: bigint | undefined;
  for (;;) {
    const batch = await prisma.collection.findMany({
      where: collectionCursor ? { id: { gt: collectionCursor } } : undefined,
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true },
    });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        await upsertCollectionSearch(row.id);
        result.collections += 1;
      } catch {
        result.errors += 1;
      }
    }
    collectionCursor = batch[batch.length - 1]!.id;
  }

  let sheetCursor: bigint | undefined;
  for (;;) {
    const batch = await prisma.stickerSheet.findMany({
      where: {
        status: PRINT_STATUS.ready,
        ...(sheetCursor ? { id: { gt: sheetCursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true },
    });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        await upsertPrintSearch("sheet", row.id);
        result.sheets += 1;
      } catch {
        result.errors += 1;
      }
    }
    sheetCursor = batch[batch.length - 1]!.id;
  }

  let packCursor: bigint | undefined;
  for (;;) {
    const batch = await prisma.stickerPack.findMany({
      where: {
        status: PRINT_STATUS.ready,
        ...(packCursor ? { id: { gt: packCursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true },
    });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        await upsertPrintSearch("pack", row.id);
        result.packs += 1;
      } catch {
        result.errors += 1;
      }
    }
    packCursor = batch[batch.length - 1]!.id;
  }

  let blobberCursor: bigint | undefined;
  for (;;) {
    const batch = await prisma.blobber.findMany({
      where: blobberCursor ? { id: { gt: blobberCursor } } : undefined,
      orderBy: { id: "asc" },
      take: BATCH,
      select: { id: true },
    });
    if (!batch.length) break;
    for (const row of batch) {
      try {
        await upsertBlobberSearch(row.id);
        result.blobbers += 1;
      } catch {
        result.errors += 1;
      }
    }
    blobberCursor = batch[batch.length - 1]!.id;
  }

  return result;
}
