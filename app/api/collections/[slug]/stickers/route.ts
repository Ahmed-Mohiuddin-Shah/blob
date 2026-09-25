import { NextResponse } from "next/server";
import { MAX_COLLECTION_STICKERS } from "@/lib/collections";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ slug: string }> };

/** Add sticker to collection (owner). Rejects at 60. */
export async function POST(request: Request, ctx: Ctx) {
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
    stickerId?: string;
  } | null;
  let stickerId: bigint;
  try {
    stickerId = BigInt(body?.stickerId ?? "");
  } catch {
    return NextResponse.json({ error: "stickerId required" }, { status: 400 });
  }

  const sticker = await prisma.sticker.findUnique({ where: { id: stickerId } });
  if (!sticker) {
    return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
  }

  const count = await prisma.collectionSticker.count({
    where: { collectionId: collection.id },
  });
  const already = await prisma.collectionSticker.findUnique({
    where: {
      collectionId_stickerId: {
        collectionId: collection.id,
        stickerId,
      },
    },
  });
  if (already) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (count >= MAX_COLLECTION_STICKERS) {
    return NextResponse.json(
      { error: `Collections are limited to ${MAX_COLLECTION_STICKERS} stickers` },
      { status: 400 },
    );
  }

  await prisma.collectionSticker.create({
    data: {
      collectionId: collection.id,
      stickerId,
      sortOrder: count,
    },
  });
  await prisma.collection.update({
    where: { id: collection.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
