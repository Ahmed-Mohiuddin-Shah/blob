/** Polymorphic favourites. UI targets: sticker | collection (sheet/pack reserved). */

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

/** Subject types the Favourites UI can create/toggle this pass. */
export const FAVORITE_UI_TYPES = [
  FAVORITE_SUBJECT.sticker,
  FAVORITE_SUBJECT.collection,
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
