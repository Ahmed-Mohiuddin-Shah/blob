import { NextResponse } from "next/server";
import {
  COLLECTION_ITEM,
  MIN_COLLECTION_ITEMS,
} from "@/lib/collections";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ slug: string; stickerId: string }> };

/** Remove a sticker item from collection (legacy path). */
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

  const count = await prisma.collectionItem.count({
    where: { collectionId: collection.id },
  });
  if (count <= MIN_COLLECTION_ITEMS) {
    return NextResponse.json(
      { error: "Collections must keep at least one item" },
      { status: 400 },
    );
  }

  const existing = await prisma.collectionItem.findUnique({
    where: {
      collectionId_subjectType_subjectId: {
        collectionId: collection.id,
        subjectType: COLLECTION_ITEM.sticker,
        subjectId: stickerId,
      },
    },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Sticker not in collection" },
      { status: 404 },
    );
  }

  await prisma.collectionItem.delete({
    where: {
      collectionId_subjectType_subjectId: {
        collectionId: collection.id,
        subjectType: COLLECTION_ITEM.sticker,
        subjectId: stickerId,
      },
    },
  });
  return NextResponse.json({ ok: true });
}
