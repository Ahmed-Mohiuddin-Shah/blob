import { NextResponse } from "next/server";
import {
  collectionCardPreviewInclude,
  COLLECTION_ITEM,
  serializeCollection,
  uniqueCollectionSlug,
  upsertTagsForCollection,
} from "@/lib/collections";
import { parseTagNames } from "@/lib/composition";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

const PAGE = 24;

const listInclude = {
  user: { select: { username: true, displayName: true } },
  tags: { include: { tag: true } },
  _count: { select: { items: true } },
  ...collectionCardPreviewInclude,
} as const;

/** Public browse + search (cursor). `mine=1` → own collections (auth). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const mine = url.searchParams.get("mine") === "1";

  if (mine) {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const rows = await prisma.collection.findMany({
      where: { userId: user.id },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: listInclude,
    });
    const hasMore = rows.length > PAGE;
    const page = hasMore ? rows.slice(0, PAGE) : rows;
    return NextResponse.json({
      items: page.map(serializeCollection),
      nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
    });
  }

  const where: {
    OR?: object[];
  } = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      {
        items: {
          some: {
            subjectType: COLLECTION_ITEM.sticker,
            // title search via sticker join not available polymorphically — name only for non-stickers
          },
        },
      },
    ];
  }

  const rows = await prisma.collection.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: listInclude,
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.id.toString() : null;

  const user = await sessionUser();
  let favouritedIds = new Set<string>();
  if (user && page.length) {
    const favs = await prisma.favorite.findMany({
      where: {
        userId: user.id,
        subjectType: FAVORITE_SUBJECT.collection,
        subjectId: { in: page.map((c) => c.id) },
      },
      select: { subjectId: true },
    });
    favouritedIds = new Set(favs.map((f) => f.subjectId.toString()));
  }

  return NextResponse.json({
    items: page.map((c) => ({
      ...serializeCollection(c),
      favourited: favouritedIds.has(c.id.toString()),
    })),
    nextCursor,
  });
}

/** Create collection (auth). Optional stickerId / subject to add as first member. */
export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string;
    tags?: string;
    stickerId?: string;
    subjectType?: string;
    subjectId?: string;
  } | null;

  const name = (body?.name ?? "").trim().slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existingName = await prisma.collection.findUnique({ where: { name } });
  if (existingName) {
    return NextResponse.json(
      { error: "A collection with that name already exists" },
      { status: 409 },
    );
  }

  const slug = await uniqueCollectionSlug(name);
  const description = (body?.description ?? "").trim() || null;
  const tagNames = parseTagNames(body?.tags ?? "");

  let firstItem: { subjectType: string; subjectId: bigint } | null = null;
  if (body?.stickerId) {
    try {
      const stickerId = BigInt(body.stickerId);
      const sticker = await prisma.sticker.findUnique({
        where: { id: stickerId },
      });
      if (!sticker) {
        return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
      }
      firstItem = {
        subjectType: COLLECTION_ITEM.sticker,
        subjectId: stickerId,
      };
    } catch {
      return NextResponse.json({ error: "Invalid stickerId" }, { status: 400 });
    }
  } else if (body?.subjectId && body.subjectType) {
    try {
      firstItem = {
        subjectType: body.subjectType,
        subjectId: BigInt(body.subjectId),
      };
    } catch {
      return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
    }
  }

  const collection = await prisma.collection.create({
    data: {
      userId: user.id,
      name,
      slug,
      description,
      ...(firstItem
        ? {
            items: {
              create: {
                subjectType: firstItem.subjectType,
                subjectId: firstItem.subjectId,
                sortOrder: 0,
              },
            },
          }
        : {}),
    },
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { items: true } },
    },
  });

  if (tagNames.length) {
    await upsertTagsForCollection(collection.id, tagNames);
  }

  const full = await prisma.collection.findUniqueOrThrow({
    where: { id: collection.id },
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { items: true } },
      ...collectionCardPreviewInclude,
    },
  });

  return NextResponse.json(serializeCollection(full), { status: 201 });
}
