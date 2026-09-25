import { NextResponse } from "next/server";
import {
  COLLECTION_ITEM,
  MIN_COLLECTION_ITEMS,
  parseCollectionItemType,
} from "@/lib/collections";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ slug: string; stickerId: string }> };

/**
 * Remove an item from collection.
 * Legacy: path param is sticker id (subjectType=sticker).
 * Preferred: ?subjectType=&subjectId= (path id ignored when subjectId present).
 */
export async function DELETE(request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { slug, stickerId: pathId } = await ctx.params;
  const collection = await prisma.collection.findUnique({ where: { slug } });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (collection.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const typeRaw = url.searchParams.get("subjectType");
  const idRaw = url.searchParams.get("subjectId") ?? pathId;

  let subjectType = parseCollectionItemType(typeRaw);
  if (!subjectType && !typeRaw) {
    subjectType = COLLECTION_ITEM.sticker;
  }
  if (!subjectType) {
    return NextResponse.json(
      { error: "subjectType must be sticker, sticker_sheet, or sticker_pack" },
      { status: 400 },
    );
  }

  let subjectId: bigint;
  try {
    subjectId = BigInt(idRaw);
  } catch {
    return NextResponse.json({ error: "Invalid subjectId" }, { status: 400 });
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
        subjectType,
        subjectId,
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Item not in collection" }, { status: 404 });
  }

  await prisma.collectionItem.delete({
    where: {
      collectionId_subjectType_subjectId: {
        collectionId: collection.id,
        subjectType,
        subjectId,
      },
    },
  });
  return NextResponse.json({ ok: true });
}
