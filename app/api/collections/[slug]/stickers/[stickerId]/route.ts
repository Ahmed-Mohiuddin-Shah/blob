import { NextResponse } from "next/server";
import { MIN_COLLECTION_STICKERS } from "@/lib/collections";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ slug: string; stickerId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { slug, stickerId: stickerIdRaw } = await ctx.params;
  const collection = await prisma.collection.findUnique({ where: { slug } });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (collection.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let stickerId: bigint;
  try {
    stickerId = BigInt(stickerIdRaw);
  } catch {
    return NextResponse.json({ error: "Invalid stickerId" }, { status: 400 });
  }

  const count = await prisma.collectionSticker.count({
    where: { collectionId: collection.id },
  });
  if (count <= MIN_COLLECTION_STICKERS) {
    return NextResponse.json(
      { error: "Collections must keep at least one sticker" },
      { status: 400 },
    );
  }

  const existing = await prisma.collectionSticker.findUnique({
    where: {
      collectionId_stickerId: { collectionId: collection.id, stickerId },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Sticker not in collection" }, { status: 404 });
  }

  await prisma.collectionSticker.delete({
    where: {
      collectionId_stickerId: { collectionId: collection.id, stickerId },
    },
  });
  return NextResponse.json({ ok: true });
}
