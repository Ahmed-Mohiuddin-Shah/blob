import { NextResponse } from "next/server";
import {
  FAVORITE_SUBJECT,
  FAVORITE_UI_TYPES,
  parseFavoriteUiType,
} from "@/lib/favorites";
import { PRINT_STATUS } from "@/lib/prints";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
} from "@/lib/stickers";

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
    subjectType: { in: [...FAVORITE_UI_TYPES] },
  };

  if (q) {
    const [matchingStickers, matchingCollections, matchingSheets, matchingPacks] =
      await Promise.all([
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
        prisma.stickerSheet.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          select: { id: true },
          take: 200,
        }),
        prisma.stickerPack.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          select: { id: true },
          take: 200,
        }),
      ]);
    where.OR = [
      {
        subjectType: FAVORITE_SUBJECT.sticker,
        subjectId: { in: matchingStickers.map((s) => s.id) },
      },
      {
        subjectType: FAVORITE_SUBJECT.collection,
        subjectId: { in: matchingCollections.map((c) => c.id) },
      },
      {
        subjectType: FAVORITE_SUBJECT.stickerSheet,
        subjectId: { in: matchingSheets.map((s) => s.id) },
      },
      {
        subjectType: FAVORITE_SUBJECT.stickerPack,
        subjectId: { in: matchingPacks.map((p) => p.id) },
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
    .filter((f) => f.subjectType === FAVORITE_SUBJECT.sticker)
    .map((f) => f.subjectId);
  const collectionIds = page
    .filter((f) => f.subjectType === FAVORITE_SUBJECT.collection)
    .map((f) => f.subjectId);
  const sheetIds = page
    .filter((f) => f.subjectType === FAVORITE_SUBJECT.stickerSheet)
    .map((f) => f.subjectId);
  const packIds = page
    .filter((f) => f.subjectType === FAVORITE_SUBJECT.stickerPack)
    .map((f) => f.subjectId);

  const [stickers, collections, sheets, packs] = await Promise.all([
    stickerIds.length
      ? prisma.sticker.findMany({
          where: { id: { in: stickerIds } },
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
        })
      : Promise.resolve([]),
    collectionIds.length
      ? prisma.collection.findMany({
          where: { id: { in: collectionIds } },
          include: {
            user: { select: { username: true, displayName: true } },
            _count: { select: { items: true } },
          },
        })
      : Promise.resolve([]),
    sheetIds.length
      ? prisma.stickerSheet.findMany({
          where: { id: { in: sheetIds } },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            stickers: { select: { stickerId: true } },
          },
        })
      : Promise.resolve([]),
    packIds.length
      ? prisma.stickerPack.findMany({
          where: { id: { in: packIds } },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            sheets: { select: { sheetId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const stickerMap = new Map(stickers.map((s) => [s.id.toString(), s]));
  const collectionMap = new Map(collections.map((c) => [c.id.toString(), c]));
  const sheetMap = new Map(sheets.map((s) => [s.id.toString(), s]));
  const packMap = new Map(packs.map((p) => [p.id.toString(), p]));

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
    if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
    return "IMAGE";
  }

  const items = page
    .map((f) => {
      if (f.subjectType === FAVORITE_SUBJECT.sticker) {
        const s = stickerMap.get(f.subjectId.toString());
        if (!s) return null;
        return {
          id: f.id.toString(),
          subjectType: FAVORITE_SUBJECT.sticker,
          subjectId: f.subjectId.toString(),
          title: s.title,
          href: `/stickers/${s.slug}`,
          thumbUrl: `/api/stickers/${s.id}/media/${MEDIA_KIND.thumbnail}`,
          type: mediaLabel(s.media.map((m) => m.kind)),
          author: s.authorName || s.createdBy.displayName || s.createdBy.username,
          createdAt: f.createdAt.toISOString(),
        };
      }
      if (f.subjectType === FAVORITE_SUBJECT.collection) {
        const c = collectionMap.get(f.subjectId.toString());
        if (!c) return null;
        return {
          id: f.id.toString(),
          subjectType: FAVORITE_SUBJECT.collection,
          subjectId: f.subjectId.toString(),
          title: c.name,
          href: `/collections/${c.slug}`,
          thumbUrl: null as string | null,
          type: "COLLECTION",
          author: c.user.displayName || c.user.username,
          stickerCount: c._count.items,
          createdAt: f.createdAt.toISOString(),
        };
      }
      if (f.subjectType === FAVORITE_SUBJECT.stickerSheet) {
        const s = sheetMap.get(f.subjectId.toString());
        if (!s) return null;
        return {
          id: f.id.toString(),
          subjectType: FAVORITE_SUBJECT.stickerSheet,
          subjectId: f.subjectId.toString(),
          title: s.name,
          href: `/prints/sheets/${s.slug}`,
          thumbUrl:
            s.status === PRINT_STATUS.ready
              ? `/api/sheets/${s.id}/media/png`
              : null,
          type: "SHEET",
          author: s.createdBy.displayName || s.createdBy.username,
          stickerCount: s.stickers.length,
          createdAt: f.createdAt.toISOString(),
        };
      }
      const p = packMap.get(f.subjectId.toString());
      if (!p) return null;
      return {
        id: f.id.toString(),
        subjectType: FAVORITE_SUBJECT.stickerPack,
        subjectId: f.subjectId.toString(),
        title: p.name,
        href: `/prints/packs/${p.slug}`,
        thumbUrl:
          p.status === PRINT_STATUS.ready
            ? `/api/packs/${p.id}/media/png`
            : null,
        type: "PACK",
        author: p.createdBy.displayName || p.createdBy.username,
        stickerCount: p.sheets.length,
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
      {
        error:
          "subjectType must be sticker, collection, sticker_sheet, or sticker_pack",
      },
      { status: 400 },
    );
  }

  let subjectId: bigint;
  try {
    subjectId = BigInt(body?.subjectId ?? "");
  } catch {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  if (subjectType === FAVORITE_SUBJECT.sticker) {
    const s = await prisma.sticker.findUnique({ where: { id: subjectId } });
    if (!s) {
      return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
    }
  } else if (subjectType === FAVORITE_SUBJECT.collection) {
    const c = await prisma.collection.findUnique({ where: { id: subjectId } });
    if (!c) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
  } else if (subjectType === FAVORITE_SUBJECT.stickerSheet) {
    const s = await prisma.stickerSheet.findUnique({ where: { id: subjectId } });
    if (!s) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }
  } else {
    const p = await prisma.stickerPack.findUnique({ where: { id: subjectId } });
    if (!p) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
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
      {
        error:
          "subjectType must be sticker, collection, sticker_sheet, or sticker_pack",
      },
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
