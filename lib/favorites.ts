/** Polymorphic favourites. UI: sticker | collection | sticker_sheet | sticker_pack. */

import { prisma } from "@/lib/prisma";

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

/** Keep stickers.likes_count in sync with sticker favourites (public like tally). */
export async function bumpStickerLikesCount(
  stickerId: bigint,
  delta: 1 | -1,
): Promise<bigint> {
  if (delta === 1) {
    const row = await prisma.sticker.update({
      where: { id: stickerId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });
    return row.likesCount;
  }
  // Clamp at 0
  const current = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: { likesCount: true },
  });
  const next =
    current && current.likesCount > BigInt(0)
      ? current.likesCount - BigInt(1)
      : BigInt(0);
  const row = await prisma.sticker.update({
    where: { id: stickerId },
    data: { likesCount: next },
    select: { likesCount: true },
  });
  return row.likesCount;
}
