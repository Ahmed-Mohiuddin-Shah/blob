import { NextResponse } from "next/server";
import {
  serializeCollection,
  uniqueCollectionSlug,
  upsertTagsForCollection,
} from "@/lib/collections";
import { parseTagNames } from "@/lib/composition";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
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
      _count: { select: { stickers: true } },
      stickers: {
        orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
        include: {
          sticker: {
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
          },
        },
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

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
    if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
    return "IMAGE";
  }

  return NextResponse.json({
    ...serializeCollection(collection),
    isOwner: user?.id === collection.userId,
    favourited,
    stickers: collection.stickers.map(({ sticker: s }) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      author: s.authorName || s.createdBy.displayName || s.createdBy.username,
      sourceUrl: s.sourceUrl,
      type: mediaLabel(s.media.map((m) => m.kind)),
      href: `/stickers/${s.slug}`,
      thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
      remixHref: `/stickers/${s.slug}/remix`,
    })),
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
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { stickers: true } },
    },
  });

  if (body?.tags !== undefined) {
    await upsertTagsForCollection(updated.id, parseTagNames(body.tags));
  }

  const full = await prisma.collection.findUniqueOrThrow({
    where: { id: updated.id },
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      _count: { select: { stickers: true } },
    },
  });

  return NextResponse.json(serializeCollection(full));
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Collections cannot be deleted" },
    { status: 405 },
  );
}
