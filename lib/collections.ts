/** Collections helpers. Always public; globally unique name + slug; 1–60 stickers. */

import { prisma } from "@/lib/prisma";
import { normalizeTagName, slugify, tagSlug } from "@/lib/stickers";

export const MAX_COLLECTION_STICKERS = 60;
export const MIN_COLLECTION_STICKERS = 1;

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
  stickers?: { stickerId: bigint }[];
  _count?: { stickers: number };
  tags?: { tag: { id: bigint; name: string; slug: string } }[];
}) {
  const stickerCount = c._count?.stickers ?? c.stickers?.length ?? 0;
  return {
    id: c.id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    href: `/collections/${c.slug}`,
    author: c.user.displayName || c.user.username,
    username: c.user.username,
    stickerCount,
    tags: (c.tags ?? []).map(({ tag }) => ({
      id: tag.id.toString(),
      name: tag.name,
      slug: tag.slug,
    })),
    createdAt: c.createdAt.toISOString(),
  };
}
