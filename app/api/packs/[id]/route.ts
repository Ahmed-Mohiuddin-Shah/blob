import { NextResponse } from "next/server";
import { canModerate } from "@/lib/capabilities";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { runPackEncode } from "@/lib/print-encode";
import { PRINT_STATUS, serializePack, serializeSheet } from "@/lib/prints";
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
  const packId = parseId(id);
  if (packId == null) {
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

/** Retry encode — failed packs only, creator (or admin). */
export async function POST(_request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const packId = parseId(id);
  if (packId == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const pack = await prisma.stickerPack.findUnique({ where: { id: packId } });
  if (!pack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (pack.createdById !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (pack.status !== PRINT_STATUS.failed) {
    return NextResponse.json(
      { error: "Only failed packs can be retried" },
      { status: 400 },
    );
  }

  await prisma.stickerPack.update({
    where: { id: packId },
    data: { status: PRINT_STATUS.pending, errorMessage: null },
  });
  await runPackEncode(packId);

  const done = await prisma.stickerPack.findUniqueOrThrow({
    where: { id: packId },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      sheets: { select: { sheetId: true } },
    },
  });

  if (done.status === PRINT_STATUS.failed) {
    return NextResponse.json(
      {
        error: done.errorMessage ?? "Pack encode failed",
        ...serializePack(done),
      },
      { status: 502 },
    );
  }

  return NextResponse.json(serializePack(done));
}

/** Delete — failed packs only, creator (or admin). */
export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const packId = parseId(id);
  if (packId == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const pack = await prisma.stickerPack.findUnique({ where: { id: packId } });
  if (!pack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (pack.createdById !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (pack.status !== PRINT_STATUS.failed) {
    return NextResponse.json(
      { error: "Only failed packs can be deleted" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.favorite.deleteMany({
      where: {
        subjectType: FAVORITE_SUBJECT.stickerPack,
        subjectId: packId,
      },
    }),
    prisma.collectionItem.deleteMany({
      where: {
        subjectType: FAVORITE_SUBJECT.stickerPack,
        subjectId: packId,
      },
    }),
    prisma.stickerPack.delete({ where: { id: packId } }),
  ]);

  return NextResponse.json({ ok: true });
}
