import { NextResponse } from "next/server";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
} from "@/lib/stickers";

const PAGE = 24;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Paginated unique stickers across all sheets in a pack (detail infinite scroll).
 * Cursor = offset into ordered unique sticker ids.
 */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let packId: bigint;
  try {
    packId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const pack = await prisma.stickerPack.findUnique({
    where: { id: packId },
    select: { id: true, status: true, createdById: true },
  });
  if (!pack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (pack.status !== PRINT_STATUS.ready) {
    const user = await sessionUser();
    if (user?.id !== pack.createdById) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const packSheets = await prisma.packSheet.findMany({
    where: { packId },
    orderBy: { sortOrder: "asc" },
    select: { sheetId: true },
  });
  const sheetIds = packSheets.map((p) => p.sheetId);
  if (!sheetIds.length) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const sheetStickers = await prisma.sheetSticker.findMany({
    where: { sheetId: { in: sheetIds } },
    orderBy: [{ sheetId: "asc" }, { sortOrder: "asc" }],
    select: { stickerId: true, sheetId: true, sortOrder: true },
  });

  // Preserve first-seen order across sheets
  const orderedIds: bigint[] = [];
  const seen = new Set<string>();
  for (const row of sheetStickers) {
    const key = row.stickerId.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    orderedIds.push(row.stickerId);
  }

  const url = new URL(request.url);
  const cursorRaw = url.searchParams.get("cursor");
  let offset = 0;
  if (cursorRaw) {
    const n = Number(cursorRaw);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    offset = n;
  }

  const slice = orderedIds.slice(offset, offset + PAGE + 1);
  const hasMore = slice.length > PAGE;
  const pageIds = hasMore ? slice.slice(0, PAGE) : slice;

  const stickers = await prisma.sticker.findMany({
    where: { id: { in: pageIds } },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      media: {
        where: {
          kind: { in: [...CARD_MEDIA_KINDS] },
          status: MEDIA_ASSET_STATUS.ready,
        },
        select: { kind: true },
      },
    },
  });
  const map = new Map(stickers.map((s) => [s.id.toString(), s]));

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
    if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
    return "IMAGE";
  }

  const items = pageIds
    .map((id) => map.get(id.toString()))
    .filter(Boolean)
    .map((s) => ({
      id: s!.id.toString(),
      title: s!.title,
      slug: s!.slug,
      author: s!.authorName || s!.createdBy.displayName || s!.createdBy.username,
      type: mediaLabel(s!.media.map((m) => m.kind)),
      href: `/stickers/${s!.slug}`,
      thumbUrl: `/api/stickers/${s!.id}/media/thumbnail`,
    }));

  return NextResponse.json({
    items,
    nextCursor: hasMore ? String(offset + PAGE) : null,
  });
}
