import { NextResponse } from "next/server";
import { canModerate } from "@/lib/capabilities";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { runSheetEncode } from "@/lib/print-encode";
import {
  PRINT_STATUS,
  serializeSheet,
} from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): bigint | null {
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sheetId = parseId(id);
  if (sheetId == null) {
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

/** Retry encode — failed sheets only, creator (or admin). */
export async function POST(_request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheetId = parseId(id);
  if (sheetId == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const sheet = await prisma.stickerSheet.findUnique({ where: { id: sheetId } });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (sheet.createdById !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (sheet.status !== PRINT_STATUS.failed) {
    return NextResponse.json(
      { error: "Only failed sheets can be retried" },
      { status: 400 },
    );
  }

  await prisma.stickerSheet.update({
    where: { id: sheetId },
    data: { status: PRINT_STATUS.pending, errorMessage: null },
  });
  await runSheetEncode(sheetId);

  const done = await prisma.stickerSheet.findUniqueOrThrow({
    where: { id: sheetId },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      stickers: { select: { stickerId: true } },
    },
  });

  if (done.status === PRINT_STATUS.failed) {
    return NextResponse.json(
      {
        error: done.errorMessage ?? "Sheet encode failed",
        ...serializeSheet(done),
      },
      { status: 502 },
    );
  }

  return NextResponse.json(serializeSheet(done));
}

/** Delete — failed sheets only, creator (or admin). Ready/pending stay immutable. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sheetId = parseId(id);
  if (sheetId == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const sheet = await prisma.stickerSheet.findUnique({ where: { id: sheetId } });
  if (!sheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (sheet.createdById !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (sheet.status !== PRINT_STATUS.failed) {
    return NextResponse.json(
      { error: "Only failed sheets can be deleted" },
      { status: 400 },
    );
  }

  const inPack = await prisma.packSheet.count({ where: { sheetId } });
  if (inPack > 0) {
    return NextResponse.json(
      { error: "This sheet is in a pack — remove it from the pack first" },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.favorite.deleteMany({
      where: {
        subjectType: FAVORITE_SUBJECT.stickerSheet,
        subjectId: sheetId,
      },
    }),
    prisma.collectionItem.deleteMany({
      where: {
        subjectType: FAVORITE_SUBJECT.stickerSheet,
        subjectId: sheetId,
      },
    }),
    prisma.stickerSheet.delete({ where: { id: sheetId } }),
  ]);

  return NextResponse.json({ ok: true });
}
