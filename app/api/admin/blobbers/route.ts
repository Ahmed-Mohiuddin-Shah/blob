import { NextResponse } from "next/server";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

/** Searchable unlinked Blobbers for admin direct edit. */
export async function GET(request: Request) {
  const user = await sessionUser();
  if (
    !user ||
    !canModerate({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const PAGE = 30;

  const rows = await prisma.blobber.findMany({
    where: {
      userId: null,
      ...(q ? { displayName: { contains: q, mode: "insensitive" as const } } : {}),
    },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      displayName: true,
      bannerGlassObjectId: true,
      avatarGlassObjectId: true,
      updatedAt: true,
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  return NextResponse.json({
    items: page.map((b) => ({
      id: b.id.toString(),
      displayName: b.displayName,
      hasBanner: !!b.bannerGlassObjectId,
      hasAvatar: !!b.avatarGlassObjectId,
      href: `/profile/unlinked-blobbers/${b.id}`,
      updatedAt: b.updatedAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}
