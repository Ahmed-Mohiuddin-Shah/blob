/** Collections helpers. Always public; globally unique name + slug; 1–60 items. */

import { prisma } from "@/lib/prisma";
import { PRINT_STATUS, mergePackSheetIds } from "@/lib/prints";
import { normalizeTagName, slugify, tagSlug } from "@/lib/stickers";

export const MAX_COLLECTION_ITEMS = 60;
export const MIN_COLLECTION_ITEMS = 1;

/** @deprecated use MAX_COLLECTION_ITEMS */
export const MAX_COLLECTION_STICKERS = MAX_COLLECTION_ITEMS;
/** @deprecated use MIN_COLLECTION_ITEMS */
export const MIN_COLLECTION_STICKERS = MIN_COLLECTION_ITEMS;

export const COLLECTION_ITEM = {
  sticker: "sticker",
  stickerSheet: "sticker_sheet",
  stickerPack: "sticker_pack",
} as const;

export const COLLECTION_ITEM_TYPES = [
  COLLECTION_ITEM.sticker,
  COLLECTION_ITEM.stickerSheet,
  COLLECTION_ITEM.stickerPack,
] as const;
export type CollectionItemType =
  (typeof COLLECTION_ITEM)[keyof typeof COLLECTION_ITEM];

export function parseCollectionItemType(
  raw: unknown,
): CollectionItemType | null {
  if (typeof raw !== "string") return null;
  return COLLECTION_ITEM_TYPES.includes(raw as CollectionItemType)
    ? (raw as CollectionItemType)
    : null;
}

export async function uniqueCollectionSlug(name: string): Promise<string> {
  const baseSlug = slugify(name, 140);
  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.collection.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export async function upsertTagsForCollection(
  collectionId: bigint,
  tagNames: string[],
) {
  await prisma.collectionTag.deleteMany({ where: { collectionId } });
  for (const name of tagNames) {
    const display = normalizeTagName(name);
    const tSlug = tagSlug(display);
    if (!tSlug || !display) continue;
    const tag = await prisma.tag.upsert({
      where: { slug: tSlug },
      create: { slug: tSlug, name: display },
      update: { name: display },
    });
    await prisma.collectionTag.create({
      data: { collectionId, tagId: tag.id },
    });
  }
}

export function serializeCollection(c: {
  id: bigint;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  user: { username: string; displayName: string };
  items?: { subjectType: string; subjectId: bigint }[];
  _count?: { items: number };
  tags?: { tag: { id: bigint; name: string; slug: string } }[];
}) {
  const itemCount = c._count?.items ?? c.items?.length ?? 0;
  const stickerIds = (c.items ?? [])
    .filter((i) => i.subjectType === COLLECTION_ITEM.sticker)
    .slice(0, 5)
    .map((i) => i.subjectId);
  const previewThumbUrls = stickerIds.map(
    (id) => `/api/stickers/${id}/media/thumbnail`,
  );
  return {
    id: c.id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    href: `/collections/${c.slug}`,
    author: c.user.displayName || c.user.username,
    username: c.user.username,
    stickerCount: itemCount,
    itemCount,
    previewThumbUrls,
    tags: (c.tags ?? []).map(({ tag }) => ({
      id: tag.id.toString(),
      name: tag.name,
      slug: tag.slug,
    })),
    createdAt: c.createdAt.toISOString(),
  };
}

/** Include for card collage: first 5 sticker items by sort order. */
export const collectionCardPreviewInclude = {
  items: {
    where: { subjectType: COLLECTION_ITEM.sticker },
    take: 5,
    orderBy: { sortOrder: "asc" as const },
    select: { subjectType: true, subjectId: true },
  },
};

/**
 * Ready sheets from a collection for combine-into-pack.
 * Expands member packs; always excludes the collection's linked pack.
 */
export async function resolveCollectionPackSheetIds(
  collectionId: bigint,
  excludePackId?: bigint | null,
): Promise<bigint[]> {
  const items = await prisma.collectionItem.findMany({
    where: { collectionId },
    orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
  });
  const sheetIds = items
    .filter((i) => i.subjectType === COLLECTION_ITEM.stickerSheet)
    .map((i) => i.subjectId);
  const packIds = items
    .filter((i) => i.subjectType === COLLECTION_ITEM.stickerPack)
    .map((i) => i.subjectId);

  const [readySheets, packs] = await Promise.all([
    sheetIds.length
      ? prisma.stickerSheet.findMany({
          where: { id: { in: sheetIds }, status: PRINT_STATUS.ready },
          select: { id: true },
        })
      : Promise.resolve([] as { id: bigint }[]),
    packIds.length
      ? prisma.stickerPack.findMany({
          where: { id: { in: packIds }, status: PRINT_STATUS.ready },
          include: {
            sheets: {
              orderBy: { sortOrder: "asc" },
              select: { sheetId: true },
            },
          },
        })
      : Promise.resolve(
          [] as {
            id: bigint;
            sheets: { sheetId: bigint }[];
          }[],
        ),
  ]);

  // Preserve collection item order for direct sheets
  const readySheetSet = new Set(readySheets.map((s) => s.id.toString()));
  const orderedDirect = sheetIds.filter((id) => readySheetSet.has(id.toString()));

  const packById = new Map(packs.map((p) => [p.id.toString(), p]));
  const orderedPacks = packIds
    .map((id) => packById.get(id.toString()))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      id: p.id,
      sheetIds: p.sheets.map((s) => s.sheetId),
    }));

  return mergePackSheetIds({
    sheetIds: orderedDirect,
    packs: orderedPacks,
    excludePackId,
  });
}
