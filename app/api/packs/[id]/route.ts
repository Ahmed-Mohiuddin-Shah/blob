import { NextResponse } from "next/server";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { PRINT_STATUS, serializePack, serializeSheet } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let packId: bigint;
  try {
    packId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const pack = await prisma.stickerPack.findUnique({
    where: { id: packId },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      sheets: {
        orderBy: { sortOrder: "asc" },
        include: {
          sheet: {
            include: {
              createdBy: { select: { username: true, displayName: true } },
              stickers: { select: { stickerId: true } },
            },
          },
        },
      },
    },
  });
  if (!pack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await sessionUser();
  if (pack.status !== PRINT_STATUS.ready && user?.id !== pack.createdById) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let favourited = false;
  if (user) {
    const fav = await prisma.favorite.findUnique({
      where: {
        userId_subjectType_subjectId: {
          userId: user.id,
          subjectType: FAVORITE_SUBJECT.stickerPack,
          subjectId: pack.id,
        },
      },
    });
    favourited = !!fav;
  }

  return NextResponse.json({
    ...serializePack(pack),
    favourited,
    sheets: pack.sheets.map(({ sheet }) => serializeSheet(sheet)),
  });
}
