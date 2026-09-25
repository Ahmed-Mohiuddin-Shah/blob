import { NextResponse } from "next/server";
import { canUpload } from "@/lib/capabilities";
import { resolveCollectionPackSheetIds } from "@/lib/collections";
import { runPackEncode } from "@/lib/print-encode";
import {
  MIN_PACK_SHEETS,
  PRINT_STATUS,
  packSheetsHash,
  serializePack,
  uniquePackSlug,
} from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

type Ctx = { params: Promise<{ slug: string }> };

const packInclude = {
  createdBy: { select: { username: true, displayName: true } },
  sheets: { select: { sheetId: true } },
} as const;

/** One-click combine: create or update the collection's linked pack. */
export async function POST(_request: Request, ctx: Ctx) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: {
      linkedPack: { select: { id: true, sheetsHash: true, slug: true } },
    },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (collection.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const excludePackId = collection.linkedPack?.id ?? null;
  const orderedSheetIds = await resolveCollectionPackSheetIds(
    collection.id,
    excludePackId,
  );

  if (orderedSheetIds.length < MIN_PACK_SHEETS) {
    return NextResponse.json(
      { error: `A pack needs at least ${MIN_PACK_SHEETS} sticker sheets` },
      { status: 400 },
    );
  }

  const sheets = await prisma.stickerSheet.findMany({
    where: { id: { in: orderedSheetIds } },
  });
  if (sheets.length !== orderedSheetIds.length) {
    return NextResponse.json(
      { error: "One or more sheets not found" },
      { status: 400 },
    );
  }
  if (sheets.some((s) => s.status === PRINT_STATUS.failed)) {
    return NextResponse.json(
      { error: "Cannot pack a failed sheet" },
      { status: 400 },
    );
  }

  const sheetsHash = packSheetsHash(orderedSheetIds);
  const linked = collection.linkedPack;

  if (linked && linked.sheetsHash === sheetsHash) {
    const done = await prisma.stickerPack.findUniqueOrThrow({
      where: { id: linked.id },
      include: packInclude,
    });
    return NextResponse.json(serializePack(done));
  }

  const hashOwner = await prisma.stickerPack.findUnique({
    where: { sheetsHash },
    select: { id: true, slug: true, name: true },
  });
  if (hashOwner && (!linked || hashOwner.id !== linked.id)) {
    return NextResponse.json(
      {
        error: "A pack with these sheets already exists",
        slug: hashOwner.slug,
        name: hashOwner.name,
      },
      { status: 409 },
    );
  }

  if (!linked) {
    const packSlug = await uniquePackSlug(collection.name);
    const pack = await prisma.stickerPack.create({
      data: {
        name: collection.name.slice(0, 200),
        slug: packSlug,
        createdById: user.id,
        status: PRINT_STATUS.pending,
        sheetsHash,
        sourceCollectionId: collection.id,
        sheets: {
          create: orderedSheetIds.map((sheetId, i) => ({
            sheetId,
            sortOrder: i,
          })),
        },
      },
      include: packInclude,
    });

    await runPackEncode(pack.id);

    const done = await prisma.stickerPack.findUniqueOrThrow({
      where: { id: pack.id },
      include: packInclude,
    });
    if (done.status === PRINT_STATUS.failed) {
      return NextResponse.json(
        {
          error: done.errorMessage ?? "Pack encode failed",
          slug: done.slug,
          status: done.status,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(serializePack(done), { status: 201 });
  }

  await prisma.$transaction([
    prisma.packSheet.deleteMany({ where: { packId: linked.id } }),
    prisma.stickerPack.update({
      where: { id: linked.id },
      data: {
        sheetsHash,
        status: PRINT_STATUS.pending,
        errorMessage: null,
        pngGlassObjectId: null,
        pngGlassPrismId: null,
        pdfGlassObjectId: null,
        pdfGlassPrismId: null,
        pngSizeBytes: null,
        pdfSizeBytes: null,
        sheets: {
          create: orderedSheetIds.map((sheetId, i) => ({
            sheetId,
            sortOrder: i,
          })),
        },
      },
    }),
  ]);

  await runPackEncode(linked.id);

  const done = await prisma.stickerPack.findUniqueOrThrow({
    where: { id: linked.id },
    include: packInclude,
  });
  if (done.status === PRINT_STATUS.failed) {
    return NextResponse.json(
      {
        error: done.errorMessage ?? "Pack encode failed",
        slug: done.slug,
        status: done.status,
      },
      { status: 502 },
    );
  }
  return NextResponse.json(serializePack(done));
}
