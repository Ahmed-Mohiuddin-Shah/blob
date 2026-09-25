import { NextResponse } from "next/server";
import { canUpload } from "@/lib/capabilities";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { runSheetEncode } from "@/lib/print-encode";
import {
  MAX_SHEET_STICKERS,
  MIN_SHEET_STICKERS,
  PRINT_STATUS,
  selectionHasNonPublic,
  serializeSheet,
  uniqueSheetSlug,
} from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";
import { canModerate } from "@/lib/capabilities";
import { MODERATION_STATUS } from "@/lib/moderation";
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  PROCESSING_STATUS,
  canAccessSticker,
  VISIBILITY,
} from "@/lib/stickers";
import { validatePrintDocument } from "blob-editor/print";

const PAGE = 24;

/** Public browse of ready sheets. */
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
    const rows = await prisma.stickerSheet.findMany({
      where: { createdById: user.id },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        createdBy: { select: { username: true, displayName: true } },
        stickers: { select: { stickerId: true } },
      },
    });
    const hasMore = rows.length > PAGE;
    const page = hasMore ? rows.slice(0, PAGE) : rows;
    return NextResponse.json({
      items: page.map(serializeSheet),
      nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
    });
  }

  const where: {
    status: string;
    OR?: object[];
  } = { status: PRINT_STATUS.ready };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.stickerSheet.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      createdBy: { select: { username: true, displayName: true } },
      stickers: { select: { stickerId: true } },
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
        subjectType: FAVORITE_SUBJECT.stickerSheet,
        subjectId: { in: page.map((s) => s.id) },
      },
      select: { subjectId: true },
    });
    favouritedIds = new Set(favs.map((f) => f.subjectId.toString()));
  }

  return NextResponse.json({
    items: page.map((s) => ({
      ...serializeSheet(s),
      favourited: favouritedIds.has(s.id.toString()),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id.toString() : null,
  });
}

/** Create a sticker sheet (always public). Async encode → pending. */
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
    document?: unknown;
    stickerIds?: string[];
    acknowledgeNonPublic?: boolean;
  } | null;

  const name = body?.name?.trim().slice(0, 200) ?? "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const stickerIdsRaw = body?.stickerIds ?? [];
  if (
    stickerIdsRaw.length < MIN_SHEET_STICKERS ||
    stickerIdsRaw.length > MAX_SHEET_STICKERS
  ) {
    return NextResponse.json(
      {
        error: `Select between ${MIN_SHEET_STICKERS} and ${MAX_SHEET_STICKERS} stickers`,
      },
      { status: 400 },
    );
  }

  let stickerIds: bigint[];
  try {
    stickerIds = [...new Set(stickerIdsRaw)].map((id) => BigInt(id));
  } catch {
    return NextResponse.json({ error: "Invalid sticker id" }, { status: 400 });
  }

  let document;
  try {
    document = validatePrintDocument(body?.document);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Invalid print document",
      },
      { status: 400 },
    );
  }

  const stickers = await prisma.sticker.findMany({
    where: { id: { in: stickerIds } },
    include: {
      media: {
        where: {
          kind: MEDIA_KIND.image,
          status: MEDIA_ASSET_STATUS.ready,
        },
        select: { id: true },
      },
    },
  });
  if (stickers.length !== stickerIds.length) {
    return NextResponse.json(
      { error: "One or more stickers not found" },
      { status: 400 },
    );
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  for (const s of stickers) {
    const publicOk =
      s.visibility === VISIBILITY.public &&
      s.moderationStatus === MODERATION_STATUS.approved &&
      s.processingStatus === PROCESSING_STATUS.ready;
    if (
      !publicOk &&
      !canAccessSticker(s, { viewerId: user.id, isAdmin })
    ) {
      return NextResponse.json(
        { error: `Cannot use sticker: ${s.title}` },
        { status: 403 },
      );
    }
    if (!s.media.length) {
      return NextResponse.json(
        { error: `Sticker not ready for print: ${s.title}` },
        { status: 400 },
      );
    }
  }

  if (selectionHasNonPublic(stickers) && !body?.acknowledgeNonPublic) {
    return NextResponse.json(
      {
        error:
          "Including private or unlisted stickers publishes their artwork on this public sheet. Confirm to continue.",
        code: "ACK_NON_PUBLIC",
      },
      { status: 400 },
    );
  }

  const slug = await uniqueSheetSlug(name);
  const sheet = await prisma.stickerSheet.create({
    data: {
      name,
      slug,
      description: body?.description?.trim() || null,
      createdById: user.id,
      printDocumentJson: document as object,
      status: PRINT_STATUS.pending,
      stickers: {
        create: stickerIds.map((stickerId, i) => ({
          stickerId,
          sortOrder: i,
        })),
      },
    },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      stickers: { select: { stickerId: true } },
    },
  });

  // Await encode in-request — void enqueue was dropped by Next after the response,
  // leaving sheets stuck on pending (and invisible on the ready-only /prints list).
  await runSheetEncode(sheet.id);

  const done = await prisma.stickerSheet.findUniqueOrThrow({
    where: { id: sheet.id },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      stickers: { select: { stickerId: true } },
    },
  });

  if (done.status === PRINT_STATUS.failed) {
    return NextResponse.json(
      {
        error: done.errorMessage ?? "Sheet encode failed",
        slug: done.slug,
        status: done.status,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(serializeSheet(done), { status: 201 });
}
