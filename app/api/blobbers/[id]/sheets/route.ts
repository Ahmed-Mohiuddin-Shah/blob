import { NextResponse } from "next/server";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";

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
    select: { userId: true, showStickerSheets: true },
  });
  if (!blobber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!blobber.showStickerSheets || !blobber.userId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.stickerSheet.findMany({
    where: { createdById: blobber.userId, status: PRINT_STATUS.ready },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return NextResponse.json({
    items: page.map((s) => ({
      id: s.id.toString(),
      title: s.name,
      href: `/prints/sheets/${s.slug}`,
      thumbUrl: `/api/sheets/${s.id}/media/png`,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}
