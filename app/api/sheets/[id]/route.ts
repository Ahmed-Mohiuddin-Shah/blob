import { NextResponse } from "next/server";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import {
  PRINT_STATUS,
  serializeSheet,
} from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let sheetId: bigint;
  try {
    sheetId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const sheet = await prisma.stickerSheet.findUnique({
    where: { id: sheetId },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      stickers: {
        orderBy: { sortOrder: "asc" },
        include: {
          sticker: {
            select: {
              id: true,
              title: true,
              slug: true,
              visibility: true,
            },
          },
        },
      },
    },
  });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Non-ready sheets only visible to creator
  const user = await sessionUser();
  if (
    sheet.status !== PRINT_STATUS.ready &&
    user?.id !== sheet.createdById
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let favourited = false;
  if (user) {
    const fav = await prisma.favorite.findUnique({
      where: {
        userId_subjectType_subjectId: {
          userId: user.id,
          subjectType: FAVORITE_SUBJECT.stickerSheet,
          subjectId: sheet.id,
        },
      },
    });
    favourited = !!fav;
  }

  return NextResponse.json({
    ...serializeSheet(sheet),
    favourited,
    stickers: sheet.stickers.map(({ sticker: s }) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      visibility: s.visibility,
      href: `/stickers/${s.slug}`,
      thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
    })),
  });
}
