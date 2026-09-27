/** Polymorphic favourites. UI: sticker | collection | sticker_sheet | sticker_pack. */

import { prisma } from "@/lib/prisma";
import { refreshStickerPopularityFromLikes } from "@/lib/search/popularity";
import { syncCollectionSearch, syncPrintSearch } from "@/lib/search/sync";

export const FAVORITE_SUBJECT = {
  sticker: "sticker",
  collection: "collection",
  stickerSheet: "sticker_sheet",
  stickerPack: "sticker_pack",
} as const;

export const FAVORITE_SUBJECT_TYPES = [
  FAVORITE_SUBJECT.sticker,
  FAVORITE_SUBJECT.collection,
  FAVORITE_SUBJECT.stickerSheet,
  FAVORITE_SUBJECT.stickerPack,
] as const;
export type FavoriteSubjectType =
  (typeof FAVORITE_SUBJECT)[keyof typeof FAVORITE_SUBJECT];

/** Subject types the Favourites UI can create/toggle. */
export const FAVORITE_UI_TYPES = [
  FAVORITE_SUBJECT.sticker,
  FAVORITE_SUBJECT.collection,
  FAVORITE_SUBJECT.stickerSheet,
  FAVORITE_SUBJECT.stickerPack,
] as const;
export type FavoriteUiType = (typeof FAVORITE_UI_TYPES)[number];

export function parseFavoriteSubjectType(
  raw: unknown,
): FavoriteSubjectType | null {
  if (typeof raw !== "string") return null;
  return FAVORITE_SUBJECT_TYPES.includes(raw as FavoriteSubjectType)
    ? (raw as FavoriteSubjectType)
    : null;
}

export function parseFavoriteUiType(raw: unknown): FavoriteUiType | null {
  if (typeof raw !== "string") return null;
  return FAVORITE_UI_TYPES.includes(raw as FavoriteUiType)
    ? (raw as FavoriteUiType)
    : null;
}

export async function isFavourited(
  userId: bigint,
  subjectType: FavoriteUiType,
  subjectId: bigint,
): Promise<boolean> {
  const row = await prisma.favorite.findUnique({
    where: {
      userId_subjectType_subjectId: { userId, subjectType, subjectId },
    },
    select: { id: true },
  });
  return !!row;
}

/** Keep denormalized likes_count in sync with favourites (public like tally). */
export async function bumpLikesCount(
  subjectType: FavoriteUiType,
  subjectId: bigint,
  delta: 1 | -1,
): Promise<bigint> {
  if (subjectType === FAVORITE_SUBJECT.sticker) {
    const likes = await bumpModelLikes(
      () =>
        prisma.sticker.update({
          where: { id: subjectId },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        }),
      async () => {
        const current = await prisma.sticker.findUnique({
          where: { id: subjectId },
          select: { likesCount: true },
        });
        const next =
          current && current.likesCount > BigInt(0)
            ? current.likesCount - BigInt(1)
            : BigInt(0);
        return prisma.sticker.update({
          where: { id: subjectId },
          data: { likesCount: next },
          select: { likesCount: true },
        });
      },
      delta,
    );
    void refreshStickerPopularityFromLikes(subjectId);
    return likes;
  }
  if (subjectType === FAVORITE_SUBJECT.collection) {
    const likes = await bumpModelLikes(
      () =>
        prisma.collection.update({
          where: { id: subjectId },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        }),
      async () => {
        const current = await prisma.collection.findUnique({
          where: { id: subjectId },
          select: { likesCount: true },
        });
        const next =
          current && current.likesCount > BigInt(0)
            ? current.likesCount - BigInt(1)
            : BigInt(0);
        return prisma.collection.update({
          where: { id: subjectId },
          data: { likesCount: next },
          select: { likesCount: true },
        });
      },
      delta,
    );
    syncCollectionSearch(subjectId);
    return likes;
  }
  if (subjectType === FAVORITE_SUBJECT.stickerSheet) {
    const likes = await bumpModelLikes(
      () =>
        prisma.stickerSheet.update({
          where: { id: subjectId },
          data: { likesCount: { increment: 1 } },
          select: { likesCount: true },
        }),
      async () => {
        const current = await prisma.stickerSheet.findUnique({
          where: { id: subjectId },
          select: { likesCount: true },
        });
        const next =
          current && current.likesCount > BigInt(0)
            ? current.likesCount - BigInt(1)
            : BigInt(0);
        return prisma.stickerSheet.update({
          where: { id: subjectId },
          data: { likesCount: next },
          select: { likesCount: true },
        });
      },
      delta,
    );
    syncPrintSearch("sheet", subjectId);
    return likes;
  }
  const likes = await bumpModelLikes(
    () =>
      prisma.stickerPack.update({
        where: { id: subjectId },
        data: { likesCount: { increment: 1 } },
        select: { likesCount: true },
      }),
    async () => {
      const current = await prisma.stickerPack.findUnique({
        where: { id: subjectId },
        select: { likesCount: true },
      });
      const next =
        current && current.likesCount > BigInt(0)
          ? current.likesCount - BigInt(1)
          : BigInt(0);
      return prisma.stickerPack.update({
        where: { id: subjectId },
        data: { likesCount: next },
        select: { likesCount: true },
      });
    },
    delta,
  );
  syncPrintSearch("pack", subjectId);
  return likes;
}

/** @deprecated use bumpLikesCount(FAVORITE_SUBJECT.sticker, …) */
export async function bumpStickerLikesCount(
  stickerId: bigint,
  delta: 1 | -1,
): Promise<bigint> {
  return bumpLikesCount(FAVORITE_SUBJECT.sticker, stickerId, delta);
}

async function bumpModelLikes(
  increment: () => Promise<{ likesCount: bigint }>,
  decrement: () => Promise<{ likesCount: bigint }>,
  delta: 1 | -1,
): Promise<bigint> {
  const row = delta === 1 ? await increment() : await decrement();
  return row.likesCount;
}

export async function readLikesCount(
  subjectType: FavoriteUiType,
  subjectId: bigint,
): Promise<bigint | null> {
  if (subjectType === FAVORITE_SUBJECT.sticker) {
    const s = await prisma.sticker.findUnique({
      where: { id: subjectId },
      select: { likesCount: true },
    });
    return s?.likesCount ?? null;
  }
  if (subjectType === FAVORITE_SUBJECT.collection) {
    const c = await prisma.collection.findUnique({
      where: { id: subjectId },
      select: { likesCount: true },
    });
    return c?.likesCount ?? null;
  }
  if (subjectType === FAVORITE_SUBJECT.stickerSheet) {
    const s = await prisma.stickerSheet.findUnique({
      where: { id: subjectId },
      select: { likesCount: true },
    });
    return s?.likesCount ?? null;
  }
  const p = await prisma.stickerPack.findUnique({
    where: { id: subjectId },
    select: { likesCount: true },
  });
  return p?.likesCount ?? null;
}
