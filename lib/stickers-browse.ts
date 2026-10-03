import { bestLibrarySearchMode } from "@/lib/capabilities";
import { blobberPublicHref } from "@/lib/blobbers";
import {
  COLLECTION_ITEM,
  subjectsInUserCollections,
} from "@/lib/collections";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  PROCESSING_STATUS,
  VISIBILITY,
  stickerPreviewUrl,
  stickerTypeFromKinds,
  videoHasAudio,
} from "@/lib/stickers";

export const STICKERS_PAGE_SIZE = 24;

export type BrowseStickerItem = {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  author: string;
  blobberId: string | null;
  blobberHref: string | null;
  sourceUrl: string | null;
  username: string;
  category: string | null;
  categorySlug: string | null;
  type: string;
  href: string;
  thumbUrl: string;
  hasAudio: boolean | null;
  remixHref: string;
  favourited: boolean;
  inCollection: boolean;
};

type BrowseUser = {
  id: bigint;
  role: string;
  accountStatus: string;
} | null;

const stickerInclude = {
  createdBy: { select: { username: true, displayName: true } },
  blobber: { select: { id: true, displayName: true, slug: true } },
  category: { select: { slug: true, name: true } },
  media: {
    where: {
      kind: { in: [...CARD_MEDIA_KINDS] },
      status: MEDIA_ASSET_STATUS.ready,
    },
    select: { kind: true, hasAudio: true, mimeType: true },
  },
};

/** Public browse + search (cursor pagination). `mine` → own stickers incl. private/unlisted. */
export async function listBrowseStickers(opts: {
  q?: string;
  category?: string;
  cursor?: string | null;
  mine?: boolean;
  user: BrowseUser;
}): Promise<{ items: BrowseStickerItem[]; nextCursor: string | null }> {
  const q = (opts.q ?? "").trim();
  const category = (opts.category ?? "").trim();
  const cursor = opts.cursor ?? null;
  const mine = !!opts.mine;
  const user = opts.user;

  if (mine && !user) {
    throw new Error("Sign in required");
  }

  const where: {
    visibility?: string;
    moderationStatus?: string;
    processingStatus: string;
    uploadedById?: bigint;
    OR?: object[];
    category?: { slug: string };
  } = mine
    ? {
        uploadedById: user!.id,
        processingStatus: PROCESSING_STATUS.ready,
      }
    : {
        visibility: VISIBILITY.public,
        moderationStatus: MODERATION_STATUS.approved,
        processingStatus: PROCESSING_STATUS.ready,
      };

  if (category) {
    where.category = { slug: category };
  }

  let meiliIds: bigint[] | null = null;
  if (q && !mine && !cursor) {
    try {
      const { meiliScopedSearch } = await import("@/lib/search/query");
      const { isMeiliConfigured } = await import("@/lib/meili/client");
      if (isMeiliConfigured()) {
        const searchUser = user
          ? { role: user.role, accountStatus: user.accountStatus }
          : null;
        const filter = category ? `categorySlug = "${category}"` : undefined;
        const found = await meiliScopedSearch({
          index: "stickers",
          q,
          mode: bestLibrarySearchMode(searchUser),
          limit: STICKERS_PAGE_SIZE + 1,
          filter,
        });
        if (found.engine === "meili") {
          meiliIds = found.hits
            .map((h) => {
              try {
                return BigInt(h.id);
              } catch {
                return null;
              }
            })
            .filter((x): x is bigint => x != null);
        }
      }
    } catch {
      meiliIds = null;
    }
  }

  if (q && meiliIds === null) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { keywords: { contains: q, mode: "insensitive" } },
      { alternateNames: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { createdBy: { username: { contains: q, mode: "insensitive" } } },
      { createdBy: { displayName: { contains: q, mode: "insensitive" } } },
      { blobber: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows =
    meiliIds != null
      ? meiliIds.length
        ? await prisma.sticker
            .findMany({
              where: { ...where, id: { in: meiliIds } },
              include: stickerInclude,
            })
            .then((list) => {
              const order = new Map(meiliIds!.map((id, i) => [id.toString(), i]));
              return list.sort(
                (a, b) =>
                  (order.get(a.id.toString()) ?? 0) -
                  (order.get(b.id.toString()) ?? 0),
              );
            })
        : Promise.resolve([])
      : prisma.sticker.findMany({
          where,
          take: STICKERS_PAGE_SIZE + 1,
          ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
          orderBy: [
            { popularityScore: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          include: stickerInclude,
        });

  const resolvedRows = await rows;
  const hasMore = meiliIds != null ? false : resolvedRows.length > STICKERS_PAGE_SIZE;
  const page = hasMore
    ? resolvedRows.slice(0, STICKERS_PAGE_SIZE)
    : resolvedRows;
  const nextCursor =
    hasMore && page.length ? page[page.length - 1]!.id.toString() : null;

  let favouritedIds = new Set<string>();
  let inCollectionIds = new Set<string>();
  if (user && page.length) {
    const ids = page.map((s) => s.id);
    const favs = await prisma.favorite.findMany({
      where: {
        userId: user.id,
        subjectType: FAVORITE_SUBJECT.sticker,
        subjectId: { in: ids },
      },
      select: { subjectId: true },
    });
    favouritedIds = new Set(favs.map((f) => f.subjectId.toString()));
    inCollectionIds = await subjectsInUserCollections(
      user.id,
      COLLECTION_ITEM.sticker,
      ids,
    );
  }

  return {
    items: page.map((s) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      visibility: s.visibility,
      author: s.blobber?.displayName ?? "",
      blobberId: s.blobber?.id.toString() ?? null,
      blobberHref: s.blobber ? blobberPublicHref(s.blobber) : null,
      sourceUrl: s.sourceUrl,
      username: s.createdBy.username,
      category: s.category?.name ?? null,
      categorySlug: s.category?.slug ?? null,
      type: stickerTypeFromKinds(s.media.map((m) => m.kind)),
      href: `/stickers/${s.slug}`,
      thumbUrl: stickerPreviewUrl(s.id, s.media),
      hasAudio: videoHasAudio(s.media),
      remixHref: `/stickers/${s.slug}/remix`,
      favourited: favouritedIds.has(s.id.toString()),
      inCollection: inCollectionIds.has(s.id.toString()),
    })),
    nextCursor,
  };
}
