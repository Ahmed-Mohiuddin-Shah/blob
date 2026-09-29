import { NextResponse } from "next/server";
import { blobberPublicHref } from "@/lib/blobbers";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  PROCESSING_STATUS,
  VISIBILITY,
  stickerPreviewUrl,
} from "@/lib/stickers";

const PAGE = 20;
const PREVIEW = 10;

/** Public Blobber directory + typeahead. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const typeahead = url.searchParams.get("typeahead") === "1";

  if (typeahead) {
    if (!q) return NextResponse.json({ items: [] });
    const rows = await prisma.blobber.findMany({
      where: { displayName: { contains: q, mode: "insensitive" } },
      take: 12,
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, userId: true },
    });
    return NextResponse.json({
      items: rows.map((b) => ({
        id: b.id.toString(),
        displayName: b.displayName,
        linked: b.userId != null,
      })),
    });
  }

  const hasPublicSticker = {
    stickers: {
      some: {
        visibility: VISIBILITY.public,
        moderationStatus: MODERATION_STATUS.approved,
        processingStatus: PROCESSING_STATUS.ready,
      },
    },
  } as const;

  const rows = await prisma.blobber.findMany({
    where: q
      ? {
          displayName: { contains: q, mode: "insensitive" },
          ...hasPublicSticker,
        }
      : { ...hasPublicSticker },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      slug: true,
      displayName: true,
      description: true,
      avatarGlassObjectId: true,
      userId: true,
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  const stickersByBlobber = await Promise.all(
    page.map((b) =>
      prisma.sticker.findMany({
        where: {
          blobberId: b.id,
          visibility: VISIBILITY.public,
          moderationStatus: MODERATION_STATUS.approved,
          processingStatus: PROCESSING_STATUS.ready,
        },
        take: PREVIEW,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        include: {
          media: {
            where: {
              kind: { in: [...CARD_MEDIA_KINDS] },
              status: MEDIA_ASSET_STATUS.ready,
            },
            select: { kind: true },
          },
        },
      }),
    ),
  );

  return NextResponse.json({
    items: page.map((b, i) => ({
      id: b.id.toString(),
      displayName: b.displayName,
      description: b.description,
      href: blobberPublicHref(b),
      linked: b.userId != null,
      stickers: stickersByBlobber[i]!.map((s) => ({
        id: s.id.toString(),
        title: s.title,
        href: `/stickers/${s.slug}`,
        thumbUrl: stickerPreviewUrl(s.id, s.media),
      })),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}
