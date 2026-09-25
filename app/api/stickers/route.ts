import { NextResponse } from "next/server";
import { canUpload } from "@/lib/capabilities";
import {
  parseAttributionInput,
  parseDocumentJson,
  parseTagNames,
  parseVisibility,
  uniqueStickerSlug,
  upsertStillExports,
  upsertTagsForSticker,
} from "@/lib/composition";
import { enqueueCompositionEncode } from "@/lib/composition-encode";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { ensurePrivatePrism } from "@/lib/private-prism";
import { sessionUser } from "@/lib/session-user";

const PAGE = 24;

/** Public browse + search (cursor pagination). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const cursor = url.searchParams.get("cursor");

  const where: {
    visibility: string;
    moderationStatus: string;
    processingStatus: string;
    OR?: object[];
    category?: { slug: string };
  } = {
    visibility: "public",
    moderationStatus: "approved",
    processingStatus: "ready",
  };

  if (category) {
    where.category = { slug: category };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { keywords: { contains: q, mode: "insensitive" } },
      { alternateNames: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { createdBy: { username: { contains: q, mode: "insensitive" } } },
      { createdBy: { displayName: { contains: q, mode: "insensitive" } } },
      { authorName: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.sticker.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      createdBy: { select: { username: true, displayName: true } },
      category: { select: { slug: true, name: true } },
      media: {
        where: { kind: { in: ["thumbnail", "image", "gif", "video"] }, status: "ready" },
        select: { kind: true },
      },
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.id.toString() : null;

  const user = await sessionUser();
  let favouritedIds = new Set<string>();
  if (user && page.length) {
    const favs = await prisma.favorite.findMany({
      where: {
        userId: user.id,
        subjectType: "sticker",
        subjectId: { in: page.map((s) => s.id) },
      },
      select: { subjectId: true },
    });
    favouritedIds = new Set(favs.map((f) => f.subjectId.toString()));
  }

  return NextResponse.json({
    items: page.map((s) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      author: s.authorName || s.createdBy.displayName || s.createdBy.username,
      authorName: s.authorName,
      sourceUrl: s.sourceUrl,
      username: s.createdBy.username,
      category: s.category?.name ?? null,
      categorySlug: s.category?.slug ?? null,
      type: mediaLabel(s.media.map((m) => m.kind)),
      href: `/stickers/${s.slug}`,
      thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
      remixHref: `/stickers/${s.slug}/remix`,
      favourited: favouritedIds.has(s.id.toString()),
    })),
    nextCursor,
  });
}

function mediaLabel(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
}

/**
 * Create sticker + composition revision from editor export.
 * Body: multipart with metadata fields + document (JSON string) + optional chat/thumbnail/full/mask blobs.
 */
export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title || title.length > 200) {
    return NextResponse.json({ error: "title required (max 200)" }, { status: 400 });
  }

  const documentRaw = form.get("document");
  if (typeof documentRaw !== "string" || !documentRaw) {
    return NextResponse.json({ error: "document JSON required" }, { status: 400 });
  }

  let documentJson: unknown;
  try {
    documentJson = JSON.parse(documentRaw);
  } catch {
    return NextResponse.json({ error: "document must be JSON" }, { status: 400 });
  }

  let doc;
  try {
    doc = parseDocumentJson(documentJson);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid document" },
      { status: 400 },
    );
  }

  const description = String(form.get("description") ?? "").trim() || null;
  const visibility = parseVisibility(String(form.get("visibility") ?? "public"));
  const categoryIdRaw = String(form.get("categoryId") ?? "").trim();
  let categoryId: bigint | null = null;
  if (categoryIdRaw) {
    const cat = await prisma.category.findUnique({ where: { id: BigInt(categoryIdRaw) } });
    if (!cat) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    categoryId = cat.id;
  }

  const tagNames = parseTagNames(String(form.get("tags") ?? ""));
  const attribution = parseAttributionInput({
    hasAttribution: String(form.get("hasAttribution") ?? ""),
    authorName: String(form.get("authorName") ?? ""),
    sourceUrl: String(form.get("sourceUrl") ?? ""),
  });
  if ("error" in attribution) {
    return NextResponse.json({ error: attribution.error }, { status: 400 });
  }

  const remixedFromRaw = String(form.get("remixedFromStickerId") ?? "").trim();
  const remixedFromStickerId = remixedFromRaw ? BigInt(remixedFromRaw) : null;
  const parentCompositionIdRaw = String(form.get("parentCompositionId") ?? "").trim();

  const chatFile = form.get("chat");
  const thumbFile = form.get("thumbnail");
  const fullFile = form.get("full");
  const maskFile = form.get("mask");

  const slug = await uniqueStickerSlug(title);

  try {
    const prismId = await ensurePrivatePrism(user.id, user.glassPrivatePrismId);

    const sticker = await prisma.$transaction(async (tx) => {
      const s = await tx.sticker.create({
        data: {
          title,
          description,
          slug,
          createdById: user.id,
          uploadedById: user.id,
          remixedFromStickerId,
          categoryId,
          authorName: attribution.authorName,
          sourceUrl: attribution.sourceUrl,
          visibility,
          moderationStatus: "pending_review",
          processingStatus: "processing",
        },
      });

      const composition = await tx.composition.create({
        data: {
          stickerId: s.id,
          ownerId: user.id,
        },
      });

      const revision = await tx.compositionRevision.create({
        data: {
          compositionId: composition.id,
          revision: 1,
          documentJson: doc as object,
          createdById: user.id,
        },
      });

      await tx.composition.update({
        where: { id: composition.id },
        data: { currentRevisionId: revision.id },
      });

      if (parentCompositionIdRaw) {
        await tx.compositionParent.create({
          data: {
            compositionId: composition.id,
            parentCompositionId: BigInt(parentCompositionIdRaw),
            sortOrder: 0,
          },
        });
      }

      return { sticker: s, composition, revision };
    });

    await upsertTagsForSticker(sticker.sticker.id, tagNames);

    if (
      chatFile instanceof File &&
      thumbFile instanceof File &&
      fullFile instanceof File
    ) {
      await upsertStillExports({
        stickerId: sticker.sticker.id,
        revisionId: sticker.revision.id,
        slug,
        prismId,
        chat: new Uint8Array(await chatFile.arrayBuffer()),
        thumbnail: new Uint8Array(await thumbFile.arrayBuffer()),
        full: new Uint8Array(await fullFile.arrayBuffer()),
        mask:
          maskFile instanceof File
            ? new Uint8Array(await maskFile.arrayBuffer())
            : undefined,
      });
    }

    await recordModerationEvent({
      subjectType: MODERATION_SUBJECT.sticker,
      subjectId: sticker.sticker.id,
      subjectTitle: sticker.sticker.title,
      action: MODERATION_ACTION.submitted,
      actorId: user.id,
    });

    enqueueCompositionEncode(sticker.sticker.id);

    return NextResponse.json({
      ok: true,
      id: sticker.sticker.id.toString(),
      slug: sticker.sticker.slug,
    });
  } catch (err) {
    console.error("Sticker create failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 502 },
    );
  }
}
