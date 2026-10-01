/** Polymorphic favourites. UI: sticker | collection | sticker_sheet | sticker_pack. */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshStickerPopularityFromLikes } from "@/lib/search/popularity";
import { syncCollectionSearch, syncPrintSearch } from "@/lib/search/sync";

type Db = Prisma.TransactionClient | typeof prisma;

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
  db: Db = prisma,
): Promise<bigint> {
  if (subjectType === FAVORITE_SUBJECT.sticker) {
    const likes = await bumpTableLikes("stickers", subjectId, delta, db);
    void refreshStickerPopularityFromLikes(subjectId);
    return likes;
  }
  if (subjectType === FAVORITE_SUBJECT.collection) {
    const likes = await bumpTableLikes("collections", subjectId, delta, db);
    syncCollectionSearch(subjectId);
    return likes;
  }
  if (subjectType === FAVORITE_SUBJECT.stickerSheet) {
    const likes = await bumpTableLikes("sticker_sheets", subjectId, delta, db);
    syncPrintSearch("sheet", subjectId);
    return likes;
  }
  const likes = await bumpTableLikes("sticker_packs", subjectId, delta, db);
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

/** Atomic increment / GREATEST(decrement, 0). */
async function bumpTableLikes(
  table:
    | "stickers"
    | "collections"
    | "sticker_sheets"
    | "sticker_packs",
  subjectId: bigint,
  delta: 1 | -1,
  db: Db,
): Promise<bigint> {
  if (table === "stickers") {
    if (delta === 1) {
      await db.$executeRaw`
        UPDATE stickers SET likes_count = likes_count + 1, updated_at = now() WHERE id = ${subjectId}
      `;
    } else {
      await db.$executeRaw`
        UPDATE stickers SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = ${subjectId}
      `;
    }
    const rows = await db.$queryRaw<Array<{ likes_count: bigint }>>`
      SELECT likes_count FROM stickers WHERE id = ${subjectId}
    `;
    return rows[0]?.likes_count ?? BigInt(0);
  }
  if (table === "collections") {
    if (delta === 1) {
      await db.$executeRaw`
        UPDATE collections SET likes_count = likes_count + 1, updated_at = now() WHERE id = ${subjectId}
      `;
    } else {
      await db.$executeRaw`
        UPDATE collections SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = ${subjectId}
      `;
    }
    const rows = await db.$queryRaw<Array<{ likes_count: bigint }>>`
      SELECT likes_count FROM collections WHERE id = ${subjectId}
    `;
    return rows[0]?.likes_count ?? BigInt(0);
  }
  if (table === "sticker_sheets") {
    if (delta === 1) {
      await db.$executeRaw`
        UPDATE sticker_sheets SET likes_count = likes_count + 1, updated_at = now() WHERE id = ${subjectId}
      `;
    } else {
      await db.$executeRaw`
        UPDATE sticker_sheets SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = ${subjectId}
      `;
    }
    const rows = await db.$queryRaw<Array<{ likes_count: bigint }>>`
      SELECT likes_count FROM sticker_sheets WHERE id = ${subjectId}
    `;
    return rows[0]?.likes_count ?? BigInt(0);
  }
  if (delta === 1) {
    await db.$executeRaw`
      UPDATE sticker_packs SET likes_count = likes_count + 1, updated_at = now() WHERE id = ${subjectId}
    `;
  } else {
    await db.$executeRaw`
      UPDATE sticker_packs SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = ${subjectId}
    `;
  }
  const rows = await db.$queryRaw<Array<{ likes_count: bigint }>>`
    SELECT likes_count FROM sticker_packs WHERE id = ${subjectId}
  `;
  return rows[0]?.likes_count ?? BigInt(0);
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
