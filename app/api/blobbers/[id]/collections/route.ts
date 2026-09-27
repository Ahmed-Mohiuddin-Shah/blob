import { NextResponse } from "next/server";
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
    select: { userId: true, showCollections: true },
  });
  if (!blobber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!blobber.showCollections || !blobber.userId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.collection.findMany({
    where: { userId: blobber.userId },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return NextResponse.json({
    items: page.map((c) => ({
      id: c.id.toString(),
      title: c.name,
      href: `/collections/${c.slug}`,
      description: c.description,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}
