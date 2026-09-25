import { NextResponse } from "next/server";
import { parseFavoriteUiType } from "@/lib/favorites";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

const PAGE = 24;

/** List own favourites (auth). `q` filters by subject title. */
export async function GET(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");

  const where: {
    userId: bigint;
    subjectType: { in: string[] };
    OR?: object[];
  } = {
    userId: user.id,
    subjectType: { in: ["sticker", "collection"] },
  };

  if (q) {
    const [matchingStickers, matchingCollections] = await Promise.all([
      prisma.sticker.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: { id: true },
        take: 200,
      }),
      prisma.collection.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true },
        take: 200,
      }),
    ]);
    where.OR = [
      {
        subjectType: "sticker",
        subjectId: { in: matchingStickers.map((s) => s.id) },
      },
      {
        subjectType: "collection",
        subjectId: { in: matchingCollections.map((c) => c.id) },
      },
    ];
  }

  const rows = await prisma.favorite.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  const stickerIds = page
    .filter((f) => f.subjectType === "sticker")
    .map((f) => f.subjectId);
  const collectionIds = page
    .filter((f) => f.subjectType === "collection")
    .map((f) => f.subjectId);

  const [stickers, collections] = await Promise.all([
    stickerIds.length
      ? prisma.sticker.findMany({
          where: { id: { in: stickerIds } },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            media: {
              where: {
                kind: { in: ["thumbnail", "image", "gif", "video"] },
                status: "ready",
              },
              select: { kind: true },
            },
          },
        })
      : Promise.resolve([]),
    collectionIds.length
      ? prisma.collection.findMany({
          where: { id: { in: collectionIds } },
          include: {
            user: { select: { username: true, displayName: true } },
            _count: { select: { stickers: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const stickerMap = new Map(stickers.map((s) => [s.id.toString(), s]));
  const collectionMap = new Map(collections.map((c) => [c.id.toString(), c]));

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes("video")) return "VIDEO";
    if (kinds.includes("gif")) return "GIF";
    return "IMAGE";
  }

  const items = page
    .map((f) => {
      if (f.subjectType === "sticker") {
        const s = stickerMap.get(f.subjectId.toString());
        if (!s) return null;
        return {
          id: f.id.toString(),
          subjectType: "sticker" as const,
          subjectId: f.subjectId.toString(),
          title: s.title,
          href: `/stickers/${s.slug}`,
          thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
          type: mediaLabel(s.media.map((m) => m.kind)),
          author: s.authorName || s.createdBy.displayName || s.createdBy.username,
          createdAt: f.createdAt.toISOString(),
        };
      }
      const c = collectionMap.get(f.subjectId.toString());
      if (!c) return null;
      return {
        id: f.id.toString(),
        subjectType: "collection" as const,
        subjectId: f.subjectId.toString(),
        title: c.name,
        href: `/collections/${c.slug}`,
        thumbUrl: null as string | null,
        type: "COLLECTION",
        author: c.user.displayName || c.user.username,
        stickerCount: c._count.stickers,
        createdAt: f.createdAt.toISOString(),
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    items,
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}

/** Upsert favourite (auth). Body: { subjectType, subjectId }. */
export async function PUT(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    subjectType?: string;
    subjectId?: string;
  } | null;

  const subjectType = parseFavoriteUiType(body?.subjectType);
  if (!subjectType) {
    return NextResponse.json(
      { error: "subjectType must be sticker or collection" },
      { status: 400 },
    );
  }

  let subjectId: bigint;
  try {
    subjectId = BigInt(body?.subjectId ?? "");
  } catch {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  if (subjectType === "sticker") {
    const s = await prisma.sticker.findUnique({ where: { id: subjectId } });
    if (!s) {
      return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
    }
  } else {
    const c = await prisma.collection.findUnique({ where: { id: subjectId } });
    if (!c) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
  }

  await prisma.favorite.upsert({
    where: {
      userId_subjectType_subjectId: {
        userId: user.id,
        subjectType,
        subjectId,
      },
    },
    create: { userId: user.id, subjectType, subjectId },
    update: {},
  });

  return NextResponse.json({ ok: true, favourited: true });
}

/** Remove favourite (auth). Body: { subjectType, subjectId }. */
export async function DELETE(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    subjectType?: string;
    subjectId?: string;
  } | null;

  const subjectType = parseFavoriteUiType(body?.subjectType);
  if (!subjectType) {
    return NextResponse.json(
      { error: "subjectType must be sticker or collection" },
      { status: 400 },
    );
  }

  let subjectId: bigint;
  try {
    subjectId = BigInt(body?.subjectId ?? "");
  } catch {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  await prisma.favorite.deleteMany({
    where: { userId: user.id, subjectType, subjectId },
  });

  return NextResponse.json({ ok: true, favourited: false });
}
