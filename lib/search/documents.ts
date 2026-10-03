import { blobberMediaUrl } from "@/lib/blobber-media-url";
import { COLLECTION_ITEM } from "@/lib/collections";
import { MODERATION_STATUS } from "@/lib/moderation";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  PROCESSING_STATUS,
  VISIBILITY,
  stickerPreviewUrl,
} from "@/lib/stickers";
import { SEARCH_META_STATUS } from "@/lib/search/constants";

function publicBase(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export type StickerSearchDoc = {
  id: string;
  slug: string;
  title: string;
  description: string;
  keywords: string;
  alternateNames: string;
  tags: string[];
  category: string;
  categorySlug: string;
  blobber: string;
  blobberId: string;
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
  previewUrl: string;
  clipPreviewUrl: string;
  mediaKind: string;
  hasAudio: boolean;
  likesCount: number;
  collectionMembershipCount: number;
  printMembershipCount: number;
  popularityScore: number;
  publishedAt: number | null;
  createdAt: number;
};

export async function buildStickerSearchDoc(
  stickerId: bigint,
  opts?: { requireSearchMeta?: boolean },
): Promise<StickerSearchDoc | null> {
  const requireSearchMeta = opts?.requireSearchMeta !== false;
  const s = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: {
      tags: { include: { tag: true } },
      category: true,
      blobber: true,
      media: true,
    },
  });
  if (!s) return null;
  if (
    s.moderationStatus !== MODERATION_STATUS.approved ||
    s.visibility !== VISIBILITY.public ||
    s.processingStatus !== PROCESSING_STATUS.ready ||
    (requireSearchMeta &&
      s.searchMetaStatus !== SEARCH_META_STATUS.approved)
  ) {
    return null;
  }

  const kinds = s.media
    .filter((m) => m.status === MEDIA_ASSET_STATUS.ready)
    .map((m) => m.kind);
  // Still-safe URL for federated `<img>` (never VIDEO-matrix mp4).
  const previewUrl = `${publicBase()}${stickerPreviewUrl(
    s.id,
    s.media.map((m) => ({
      kind: m.kind,
      status: m.status,
      mimeType: m.mimeType,
    })),
  )}`;
  let aiVisualTags: string[] = [];
  try {
    aiVisualTags = s.aiVisualTags ? (JSON.parse(s.aiVisualTags) as string[]) : [];
  } catch {
    aiVisualTags = [];
  }

  return {
    id: s.id.toString(),
    slug: s.slug,
    title: s.title,
    description: s.description ?? "",
    keywords: s.keywords ?? "",
    alternateNames: s.alternateNames ?? "",
    tags: s.tags.map((t) => t.tag.name),
    category: s.category?.name ?? "",
    categorySlug: s.category?.slug ?? "",
    blobber: s.blobber?.displayName ?? "",
    blobberId: s.blobberId?.toString() ?? "",
    aiCaption: s.aiCaption ?? "",
    aiScenario: s.aiScenario ?? "",
    aiVisualTags,
    previewUrl,
    // CLIP: storyboard for gif/video when present (same grid as vision enrich).
    clipPreviewUrl: kinds.includes(MEDIA_KIND.storyboard)
      ? `${publicBase()}/api/stickers/${s.id}/media/${MEDIA_KIND.storyboard}`
      : previewUrl,
    mediaKind: kinds.includes(MEDIA_KIND.video)
      ? "video"
      : kinds.includes(MEDIA_KIND.gif)
        ? "gif"
        : "image",
    hasAudio: s.media.some((m) => m.hasAudio),
    likesCount: Number(s.likesCount),
    collectionMembershipCount: Number(s.collectionMembershipCount),
    printMembershipCount: Number(s.printMembershipCount),
    popularityScore: Number(s.popularityScore),
    publishedAt: s.publishedAt ? s.publishedAt.getTime() : null,
    createdAt: s.createdAt.getTime(),
  };
}

export async function buildCollectionSearchDoc(collectionId: bigint) {
  const c = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      items: {
        where: { subjectType: COLLECTION_ITEM.sticker },
        orderBy: { sortOrder: "asc" },
        take: 40,
      },
    },
  });
  if (!c) return null;
  const stickerIds = c.items.map((i) => i.subjectId);
  const stickers = stickerIds.length
    ? await prisma.sticker.findMany({
        where: {
          id: { in: stickerIds },
          searchMetaStatus: SEARCH_META_STATUS.approved,
        },
        select: { id: true, title: true, aiCaption: true },
      })
    : [];
  const coverId = stickerIds[0];
  return {
    id: c.id.toString(),
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    memberText: stickers
      .map((s) => `${s.title} ${s.aiCaption ?? ""}`)
      .join(" ")
      .slice(0, 4000),
    previewUrl: coverId
      ? `/api/stickers/${coverId}/media/thumbnail`
      : "",
    likesCount: Number(c.likesCount),
    updatedAt: c.updatedAt.getTime(),
  };
}

/** Meili primary keys allow [a-zA-Z0-9_-] only — no colons. */
export function printSearchDocId(kind: "sheet" | "pack", id: bigint | string) {
  return `${kind}-${id}`;
}

export async function buildPrintSearchDoc(
  kind: "sheet" | "pack",
  id: bigint,
) {
  if (kind === "sheet") {
    const sheet = await prisma.stickerSheet.findUnique({
      where: { id },
      include: {
        stickers: {
          include: {
            sticker: { select: { title: true, aiCaption: true } },
          },
        },
      },
    });
    if (!sheet || sheet.status !== PRINT_STATUS.ready) return null;
    return {
      id: printSearchDocId("sheet", sheet.id),
      kind: "sheet" as const,
      slug: sheet.slug,
      name: sheet.name,
      description: sheet.description ?? "",
      memberText: sheet.stickers
        .map((x) => `${x.sticker.title} ${x.sticker.aiCaption ?? ""}`)
        .join(" ")
        .slice(0, 4000),
      previewUrl: `/api/sheets/${sheet.id}/media/png`,
      likesCount: Number(sheet.likesCount),
      updatedAt: sheet.updatedAt.getTime(),
    };
  }
  const pack = await prisma.stickerPack.findUnique({
    where: { id },
    include: {
      sheets: {
        include: {
          sheet: {
            include: {
              stickers: {
                include: {
                  sticker: { select: { title: true, aiCaption: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!pack || pack.status !== PRINT_STATUS.ready) return null;
  const memberText = pack.sheets
    .flatMap((ps) =>
      ps.sheet.stickers.map(
        (x) => `${x.sticker.title} ${x.sticker.aiCaption ?? ""}`,
      ),
    )
    .join(" ")
    .slice(0, 4000);
  return {
    id: printSearchDocId("pack", pack.id),
    kind: "pack" as const,
    slug: pack.slug,
    name: pack.name,
    description: pack.description ?? "",
    memberText,
    previewUrl: `/api/packs/${pack.id}/media/png`,
    likesCount: Number(pack.likesCount),
    updatedAt: pack.updatedAt.getTime(),
  };
}

export async function buildBlobberSearchDoc(blobberId: bigint) {
  const b = await prisma.blobber.findUnique({
    where: { id: blobberId },
    include: {
      _count: {
        select: {
          stickers: {
            where: {
              moderationStatus: MODERATION_STATUS.approved,
              visibility: VISIBILITY.public,
              processingStatus: PROCESSING_STATUS.ready,
            },
          },
        },
      },
    },
  });
  if (!b) return null;
  return {
    id: b.id.toString(),
    displayName: b.displayName,
    slug: b.slug,
    bio: b.description ?? "",
    stickerCount: b._count.stickers,
    previewUrl: blobberMediaUrl(b.avatarGlassObjectId) ?? "",
  };
}
