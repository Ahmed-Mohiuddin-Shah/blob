import { NextResponse } from "next/server";
import { bestLibrarySearchMode, canUpload } from "@/lib/capabilities";
import { parseBlobberAttributionInput } from "@/lib/blobbers";
import {
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
  MODERATION_STATUS,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { ensurePrivatePrism } from "@/lib/private-prism";
import { sessionUser } from "@/lib/session-user";
import {
  COLLECTION_ITEM,
  subjectsInUserCollections,
} from "@/lib/collections";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  PROCESSING_STATUS,
  VISIBILITY,
  stickerPreviewUrl,
  stickerTypeFromKinds,
  videoHasAudio,
} from "@/lib/stickers";

const PAGE = 24;

/** Public browse + search (cursor pagination). `mine=1` → own stickers incl. private/unlisted. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const mine = url.searchParams.get("mine") === "1";

  const userEarly = mine ? await sessionUser() : null;
  if (mine && !userEarly) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const where: {
    visibility?: string;
    moderationStatus?: string;
    processingStatus: string;
    uploadedById?: bigint;
    OR?: object[];
    category?: { slug: string };
  } = mine
    ? {
        uploadedById: userEarly!.id,
        processingStatus: PROCESSING_STATUS.ready,
      }
    : {
        visibility: VISIBILITY.public,
        moderationStatus: MODERATION_STATUS.approved,
        processingStatus: PROCESSING_STATUS.ready,
      };

  if (category) {
    where.category = { slug: category };
  }

  // Prefer Meili for public text search (Prisma fallback inside meiliScopedSearch).
  let meiliIds: bigint[] | null = null;
  if (q && !mine && !cursor) {
    try {
      const { meiliScopedSearch } = await import("@/lib/search/query");
      const { isMeiliConfigured } = await import("@/lib/meili/client");
      if (isMeiliConfigured()) {
        const searchUser =
          userEarly ??
          (await sessionUser().then((u) =>
            u ? { role: u.role, accountStatus: u.accountStatus } : null,
          ));
        const filter = category ? `categorySlug = "${category}"` : undefined;
        const found = await meiliScopedSearch({
          index: "stickers",
          q,
          mode: bestLibrarySearchMode(searchUser),
          limit: PAGE + 1,
          filter,
        });
        if (found.engine === "meili") {
          meiliIds = found.hits
            .map((h) => {
              try {
                return BigInt(h.id);
              } catch {
                return null;
              }
            })
            .filter((x): x is bigint => x != null);
        }
      }
    } catch {
      meiliIds = null;
    }
  }

  if (q && meiliIds === null) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { keywords: { contains: q, mode: "insensitive" } },
      { alternateNames: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { createdBy: { username: { contains: q, mode: "insensitive" } } },
      { createdBy: { displayName: { contains: q, mode: "insensitive" } } },
      { blobber: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows =
    meiliIds != null
      ? meiliIds.length
        ? await prisma.sticker.findMany({
            where: { ...where, id: { in: meiliIds } },
            include: {
              createdBy: { select: { username: true, displayName: true } },
              blobber: { select: { id: true, displayName: true } },
              category: { select: { slug: true, name: true } },
              media: {
                where: {
                  kind: { in: [...CARD_MEDIA_KINDS] },
                  status: MEDIA_ASSET_STATUS.ready,
                },
                select: { kind: true, hasAudio: true },
              },
            },
          }).then((list) => {
            const order = new Map(meiliIds!.map((id, i) => [id.toString(), i]));
            return list.sort(
              (a, b) =>
                (order.get(a.id.toString()) ?? 0) -
                (order.get(b.id.toString()) ?? 0),
            );
          })
        : Promise.resolve([])
      : prisma.sticker.findMany({
          where,
          take: PAGE + 1,
          ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
          orderBy: [{ popularityScore: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          include: {
            createdBy: { select: { username: true, displayName: true } },
            blobber: { select: { id: true, displayName: true } },
            category: { select: { slug: true, name: true } },
            media: {
              where: {
                kind: { in: [...CARD_MEDIA_KINDS] },
                status: MEDIA_ASSET_STATUS.ready,
              },
              select: { kind: true, hasAudio: true },
            },
          },
        });

  const resolvedRows = await rows;

  const hasMore = meiliIds != null ? false : resolvedRows.length > PAGE;
  const page = hasMore ? resolvedRows.slice(0, PAGE) : resolvedRows;
  const nextCursor =
    hasMore && page.length ? page[page.length - 1]!.id.toString() : null;

  const user = await sessionUser();
  let favouritedIds = new Set<string>();
  let inCollectionIds = new Set<string>();
  if (user && page.length) {
    const ids = page.map((s) => s.id);
    const favs = await prisma.favorite.findMany({
      where: {
        userId: user.id,
        subjectType: FAVORITE_SUBJECT.sticker,
        subjectId: { in: ids },
      },
      select: { subjectId: true },
    });
    favouritedIds = new Set(favs.map((f) => f.subjectId.toString()));
    inCollectionIds = await subjectsInUserCollections(
      user.id,
      COLLECTION_ITEM.sticker,
      ids,
    );
  }

  return NextResponse.json({
    items: page.map((s) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      visibility: s.visibility,
      author: s.blobber?.displayName ?? "",
      blobberId: s.blobber?.id.toString() ?? null,
      blobberHref: s.blobber ? `/blobbers/${s.blobber.id}` : null,
      sourceUrl: s.sourceUrl,
      username: s.createdBy.username,
      category: s.category?.name ?? null,
      categorySlug: s.category?.slug ?? null,
      type: stickerTypeFromKinds(s.media.map((m) => m.kind)),
      href: `/stickers/${s.slug}`,
      thumbUrl: stickerPreviewUrl(s.id, s.media),
      hasAudio: videoHasAudio(s.media),
      remixHref: `/stickers/${s.slug}/remix`,
      favourited: favouritedIds.has(s.id.toString()),
      inCollection: inCollectionIds.has(s.id.toString()),
    })),
    nextCursor,
  });
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
  const visibility = parseVisibility(String(form.get("visibility") ?? VISIBILITY.public));
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
  const attribution = await parseBlobberAttributionInput({
    mode: String(form.get("attributionMode") ?? "self"),
    blobberId: String(form.get("blobberId") ?? ""),
    blobberDisplayName: String(form.get("blobberDisplayName") ?? ""),
    sourceUrl: String(form.get("sourceUrl") ?? ""),
    userId: user.id,
    userDisplayName: user.displayName,
    username: user.username,
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
          blobberId: attribution.blobberId,
          sourceUrl: attribution.sourceUrl,
          visibility,
          moderationStatus: MODERATION_STATUS.pendingReview,
          processingStatus: PROCESSING_STATUS.processing,
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
