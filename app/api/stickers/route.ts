import { NextResponse } from "next/server";
import { canUpload } from "@/lib/capabilities";
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
import { listBrowseStickers } from "@/lib/stickers-browse";
import { PROCESSING_STATUS, VISIBILITY } from "@/lib/stickers";

/** Public browse + search (cursor pagination). `mine=1` → own stickers incl. private/unlisted. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const mine = url.searchParams.get("mine") === "1";

  const user = await sessionUser();
  if (mine && !user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const result = await listBrowseStickers({
      q,
      category,
      cursor,
      mine,
      user: user
        ? {
            id: user.id,
            role: user.role,
            accountStatus: user.accountStatus,
          }
        : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Sign in required") {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    throw err;
  }
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
