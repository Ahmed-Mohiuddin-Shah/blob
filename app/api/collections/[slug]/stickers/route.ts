import { NextResponse } from "next/server";
import {
  COLLECTION_ITEM,
  MAX_COLLECTION_ITEMS,
  parseCollectionItemType,
} from "@/lib/collections";
import { PRINT_STATUS } from "@/lib/prints";
import { sessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ slug: string }> };

/** Add item to collection (owner). Body: { subjectType, subjectId } or legacy { stickerId }. */
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
    subjectType?: string;
    subjectId?: string;
  } | null;

  let subjectType = parseCollectionItemType(body?.subjectType);
  let subjectId: bigint;
  try {
    if (body?.stickerId && !body.subjectType) {
      subjectType = COLLECTION_ITEM.sticker;
      subjectId = BigInt(body.stickerId);
    } else {
      subjectId = BigInt(body?.subjectId ?? "");
    }
  } catch {
    return NextResponse.json(
      { error: "subjectId (or stickerId) required" },
      { status: 400 },
    );
  }
  if (!subjectType) {
    return NextResponse.json(
      { error: "subjectType must be sticker, sticker_sheet, or sticker_pack" },
      { status: 400 },
    );
  }

  if (subjectType === COLLECTION_ITEM.sticker) {
    const s = await prisma.sticker.findUnique({ where: { id: subjectId } });
    if (!s) {
      return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
    }
  } else if (subjectType === COLLECTION_ITEM.stickerSheet) {
    const s = await prisma.stickerSheet.findUnique({ where: { id: subjectId } });
    if (!s || s.status !== PRINT_STATUS.ready) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }
  } else {
    const p = await prisma.stickerPack.findUnique({ where: { id: subjectId } });
    if (!p || p.status !== PRINT_STATUS.ready) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }
  }

  const count = await prisma.collectionItem.count({
    where: { collectionId: collection.id },
  });
  const already = await prisma.collectionItem.findUnique({
    where: {
      collectionId_subjectType_subjectId: {
        collectionId: collection.id,
        subjectType,
        subjectId,
      },
    },
  });
  if (already) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (count >= MAX_COLLECTION_ITEMS) {
    return NextResponse.json(
      { error: `Collections are limited to ${MAX_COLLECTION_ITEMS} items` },
      { status: 400 },
    );
  }

  await prisma.collectionItem.create({
    data: {
      collectionId: collection.id,
      subjectType,
      subjectId,
      sortOrder: count,
    },
  });
  await prisma.collection.update({
    where: { id: collection.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
