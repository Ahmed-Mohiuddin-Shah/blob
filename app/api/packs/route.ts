import { NextResponse } from "next/server";
import { canUpload } from "@/lib/capabilities";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { runPackEncode } from "@/lib/print-encode";
import {
  MIN_PACK_SHEETS,
  PRINT_STATUS,
  serializePack,
  uniquePackSlug,
} from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

const PAGE = 24;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const mine = url.searchParams.get("mine") === "1";

  if (mine) {
    const user = await sessionUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const rows = await prisma.stickerPack.findMany({
      where: { createdById: user.id },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        createdBy: { select: { username: true, displayName: true } },
        sheets: { select: { sheetId: true } },
      },
    });
    const hasMore = rows.length > PAGE;
    const page = hasMore ? rows.slice(0, PAGE) : rows;
    return NextResponse.json({
      items: page.map(serializePack),
      nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
    });
  }

  const where: { status: string; OR?: object[] } = {
    status: PRINT_STATUS.ready,
  };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.stickerPack.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      createdBy: { select: { username: true, displayName: true } },
      sheets: { select: { sheetId: true } },
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;

  const user = await sessionUser();
  let favouritedIds = new Set<string>();
  if (user && page.length) {
    const favs = await prisma.favorite.findMany({
      where: {
        userId: user.id,
        subjectType: FAVORITE_SUBJECT.stickerPack,
        subjectId: { in: page.map((p) => p.id) },
      },
      select: { subjectId: true },
    });
    favouritedIds = new Set(favs.map((f) => f.subjectId.toString()));
  }

  return NextResponse.json({
    items: page.map((p) => ({
      ...serializePack(p),
      favourited: favouritedIds.has(p.id.toString()),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}

/** Create pack from ≥2 sheet ids (or expand pack ids into their sheets). */
export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string;
    sheetIds?: string[];
    packIds?: string[];
  } | null;

  const name = body?.name?.trim().slice(0, 200) ?? "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const orderedSheetIds: bigint[] = [];
  const seen = new Set<string>();

  for (const raw of body?.sheetIds ?? []) {
    try {
      const id = BigInt(raw);
      const key = id.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      orderedSheetIds.push(id);
    } catch {
      return NextResponse.json({ error: "Invalid sheet id" }, { status: 400 });
    }
  }

  // Expand packs → their sheet refs (preserve order, dedupe)
  for (const raw of body?.packIds ?? []) {
    let packId: bigint;
    try {
      packId = BigInt(raw);
    } catch {
      return NextResponse.json({ error: "Invalid pack id" }, { status: 400 });
    }
    const pack = await prisma.stickerPack.findUnique({
      where: { id: packId },
      include: {
        sheets: { orderBy: { sortOrder: "asc" }, select: { sheetId: true } },
      },
    });
    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 400 });
    }
    for (const { sheetId } of pack.sheets) {
      const key = sheetId.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      orderedSheetIds.push(sheetId);
    }
  }

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

  const slug = await uniquePackSlug(name);
  const pack = await prisma.stickerPack.create({
    data: {
      name,
      slug,
      description: body?.description?.trim() || null,
      createdById: user.id,
      status: PRINT_STATUS.pending,
      sheets: {
        create: orderedSheetIds.map((sheetId, i) => ({
          sheetId,
          sortOrder: i,
        })),
      },
    },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      sheets: { select: { sheetId: true } },
    },
  });

  await runPackEncode(pack.id);

  const done = await prisma.stickerPack.findUniqueOrThrow({
    where: { id: pack.id },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      sheets: { select: { sheetId: true } },
    },
  });

  // Member sheets still encoding — stay pending; detail page will re-kick.
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
