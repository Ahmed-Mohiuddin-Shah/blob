import { NextResponse } from "next/server";
import {
  COLLECTION_ITEM,
  serializeCollection,
  uniqueCollectionSlug,
  upsertTagsForCollection,
} from "@/lib/collections";
import { parseTagNames } from "@/lib/composition";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { PRINT_STATUS } from "@/lib/prints";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
} from "@/lib/stickers";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { items: true } },
      items: {
        orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
      },
    },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await sessionUser();
  let favourited = false;
  if (user) {
    const fav = await prisma.favorite.findUnique({
      where: {
        userId_subjectType_subjectId: {
          userId: user.id,
          subjectType: FAVORITE_SUBJECT.collection,
          subjectId: collection.id,
        },
      },
    });
    favourited = !!fav;
  }

  const stickerIds = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.sticker)
    .map((i) => i.subjectId);
  const sheetIds = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.stickerSheet)
    .map((i) => i.subjectId);
  const packIds = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.stickerPack)
    .map((i) => i.subjectId);

  const [stickers, sheets, packs] = await Promise.all([
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
    sheetIds.length
      ? prisma.stickerSheet.findMany({
          where: { id: { in: sheetIds }, status: PRINT_STATUS.ready },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            stickers: { select: { stickerId: true } },
          },
        })
      : Promise.resolve([]),
    packIds.length
      ? prisma.stickerPack.findMany({
          where: { id: { in: packIds }, status: PRINT_STATUS.ready },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            sheets: { select: { sheetId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const stickerMap = new Map(stickers.map((s) => [s.id.toString(), s]));
  const sheetMap = new Map(sheets.map((s) => [s.id.toString(), s]));
  const packMap = new Map(packs.map((p) => [p.id.toString(), p]));

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
    if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
    return "IMAGE";
  }

  const items = collection.items
    .map((item) => {
      if (item.subjectType === COLLECTION_ITEM.sticker) {
        const s = stickerMap.get(item.subjectId.toString());
        if (!s) return null;
        return {
          subjectType: COLLECTION_ITEM.sticker,
          id: s.id.toString(),
          title: s.title,
          slug: s.slug,
          author: s.authorName || s.createdBy.displayName || s.createdBy.username,
          type: mediaLabel(s.media.map((m) => m.kind)),
          href: `/stickers/${s.slug}`,
          thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
          remixHref: `/stickers/${s.slug}/remix`,
          visibility: s.visibility,
        };
      }
      if (item.subjectType === COLLECTION_ITEM.stickerSheet) {
        const s = sheetMap.get(item.subjectId.toString());
        if (!s) return null;
        return {
          subjectType: COLLECTION_ITEM.stickerSheet,
          id: s.id.toString(),
          title: s.name,
          slug: s.slug,
          author: s.createdBy.displayName || s.createdBy.username,
          type: "SHEET",
          href: `/prints/sheets/${s.slug}`,
          thumbUrl: `/api/sheets/${s.id}/media/png`,
          stickerCount: s.stickers.length,
        };
      }
      const p = packMap.get(item.subjectId.toString());
      if (!p) return null;
      return {
        subjectType: COLLECTION_ITEM.stickerPack,
        id: p.id.toString(),
        title: p.name,
        slug: p.slug,
        author: p.createdBy.displayName || p.createdBy.username,
        type: "PACK",
        href: `/prints/packs/${p.slug}`,
        thumbUrl: `/api/packs/${p.id}/media/png`,
        sheetCount: p.sheets.length,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    ...serializeCollection(collection),
    isOwner: user?.id === collection.userId,
    favourited,
    items,
    // Back-compat for clients expecting stickers[]
    stickers: items.filter((i) => i?.subjectType === COLLECTION_ITEM.sticker),
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const collection = await prisma.collection.findUnique({ where: { slug } });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (collection.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string;
    tags?: string;
  } | null;

  const data: { name?: string; slug?: string; description?: string | null } = {};

  if (body?.name !== undefined) {
    const name = body.name.trim().slice(0, 120);
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name !== collection.name) {
      const clash = await prisma.collection.findUnique({ where: { name } });
      if (clash) {
        return NextResponse.json(
          { error: "A collection with that name already exists" },
          { status: 409 },
        );
      }
      data.name = name;
      data.slug = await uniqueCollectionSlug(name);
    }
  }

  if (body?.description !== undefined) {
    data.description = body.description.trim() || null;
  }

  const updated = await prisma.collection.update({
    where: { id: collection.id },
    data,
  });

  if (body?.tags !== undefined) {
    await upsertTagsForCollection(updated.id, parseTagNames(body.tags));
  }

  const full = await prisma.collection.findUniqueOrThrow({
    where: { id: updated.id },
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(serializeCollection(full));
}
