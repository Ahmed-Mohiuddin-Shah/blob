import { COLLECTION_ITEM } from "@/lib/collections";
import { prisma } from "@/lib/prisma";
import { patchStickerPopularity } from "@/lib/search/sync";

function score(likes: bigint, collections: bigint, prints: bigint): bigint {
  return likes + collections + prints;
}

/** Recompute membership counters + popularityScore for one sticker. */
export async function recomputeStickerPopularity(
  stickerId: bigint,
): Promise<void> {
  const [likesRow, collectionMembershipCount, sheetCount, packViaSheet] =
    await Promise.all([
      prisma.sticker.findUnique({
        where: { id: stickerId },
        select: { likesCount: true },
      }),
      prisma.collectionItem.count({
        where: {
          subjectType: COLLECTION_ITEM.sticker,
          subjectId: stickerId,
        },
      }),
      prisma.sheetSticker.count({ where: { stickerId } }),
      prisma.packSheet.count({
        where: {
          sheet: { stickers: { some: { stickerId } } },
        },
      }),
    ]);
  if (!likesRow) return;

  const printMembershipCount = BigInt(sheetCount + packViaSheet);
  const collectionCount = BigInt(collectionMembershipCount);
  const popularityScore = score(
    likesRow.likesCount,
    collectionCount,
    printMembershipCount,
  );

  await prisma.sticker.update({
    where: { id: stickerId },
    data: {
      collectionMembershipCount: collectionCount,
      printMembershipCount,
      popularityScore,
    },
  });

  void patchStickerPopularity(stickerId, {
    likesCount: Number(likesRow.likesCount),
    collectionMembershipCount: Number(collectionCount),
    printMembershipCount: Number(printMembershipCount),
    popularityScore: Number(popularityScore),
  });
}

/** After likesCount already changed — refresh popularityScore only. */
export async function refreshStickerPopularityFromLikes(
  stickerId: bigint,
): Promise<void> {
  const row = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: {
      likesCount: true,
      collectionMembershipCount: true,
      printMembershipCount: true,
    },
  });
  if (!row) return;
  const popularityScore = score(
    row.likesCount,
    row.collectionMembershipCount,
    row.printMembershipCount,
  );
  await prisma.sticker.update({
    where: { id: stickerId },
    data: { popularityScore },
  });
  void patchStickerPopularity(stickerId, {
    likesCount: Number(row.likesCount),
    collectionMembershipCount: Number(row.collectionMembershipCount),
    printMembershipCount: Number(row.printMembershipCount),
    popularityScore: Number(popularityScore),
  });
}
