import { NextResponse } from "next/server";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  stickerPreviewUrl,
  stickerTypeFromKinds,
  videoHasAudio,
} from "@/lib/stickers";

const PAGE = 24;

type Ctx = { params: Promise<{ id: string }> };

/** Paginated stickers on a sheet (for detail infinite scroll). */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let sheetId: bigint;
  try {
    sheetId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const sheet = await prisma.stickerSheet.findUnique({
    where: { id: sheetId },
    select: { id: true, status: true, createdById: true },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sheet.status !== PRINT_STATUS.ready) {
    const user = await sessionUser();
    if (user?.id !== sheet.createdById) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  let cursorSort: number | undefined;
  if (cursor) {
    const n = Number(cursor);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    cursorSort = n;
  }

  const rows = await prisma.sheetSticker.findMany({
    where: {
      sheetId,
      ...(cursorSort !== undefined ? { sortOrder: { gt: cursorSort } } : {}),
    },
    take: PAGE + 1,
    orderBy: { sortOrder: "asc" },
    include: {
      sticker: {
        include: {
          createdBy: { select: { username: true, displayName: true } },
          blobber: { select: { id: true, displayName: true } },
          media: {
            where: {
              kind: { in: [...CARD_MEDIA_KINDS] },
              status: MEDIA_ASSET_STATUS.ready,
            },
            select: { kind: true, hasAudio: true },
          },
        },
      },
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return NextResponse.json({
    items: page.map(({ sticker: s, sortOrder }) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      author: s.blobber?.displayName ?? "",
      blobberHref: s.blobber ? `/blobbers/${s.blobber.id}` : null,
      type: stickerTypeFromKinds(s.media.map((m) => m.kind)),
      href: `/stickers/${s.slug}`,
      thumbUrl: stickerPreviewUrl(s.id, s.media),
      hasAudio: videoHasAudio(s.media),
      sortOrder,
    })),
    nextCursor: hasMore
      ? String(page[page.length - 1]!.sortOrder)
      : null,
  });
}
