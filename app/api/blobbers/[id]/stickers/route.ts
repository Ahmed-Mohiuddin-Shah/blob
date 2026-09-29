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
  stickerTypeFromKinds,
  videoHasAudio,
} from "@/lib/stickers";

const PAGE = 24;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let blobberId: bigint;
  try {
    blobberId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const blobber = await prisma.blobber.findUnique({
    where: { id: blobberId },
    select: { id: true, slug: true },
  });
  if (!blobber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.sticker.findMany({
    where: {
      blobberId,
      visibility: VISIBILITY.public,
      moderationStatus: MODERATION_STATUS.approved,
      processingStatus: PROCESSING_STATUS.ready,
    },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    include: {
      media: {
        where: {
          kind: { in: [...CARD_MEDIA_KINDS] },
          status: MEDIA_ASSET_STATUS.ready,
        },
        select: { kind: true, hasAudio: true, status: true },
      },
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return NextResponse.json({
    items: page.map((s) => ({
      id: s.id.toString(),
      title: s.title,
      href: `/stickers/${s.slug}`,
      thumbUrl: stickerPreviewUrl(s.id, s.media),
      type: stickerTypeFromKinds(s.media.map((m) => m.kind)),
      hasAudio: videoHasAudio(s.media),
      author: "",
      sourceUrl: s.sourceUrl,
      blobberHref: blobberPublicHref(blobber),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}
