import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate, canUpload } from "@/lib/capabilities";
import { parseDocumentJson, remixDocument, uniqueStickerSlug } from "@/lib/composition";
import { enqueueCompositionEncode } from "@/lib/composition-encode";
import {
  MODERATION_ACTION,
  MODERATION_STATUS,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  canAccessSticker,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  PROCESSING_STATUS,
  VISIBILITY,
} from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/**
 * Snapshot remix: deep-copy document, shared asset ids, remixed_from_sticker_id + composition_parents.
 * Returns new sticker id/slug so the client can open the editor (optional document override on first save).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const source = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: {
      composition: true,
      media: { where: { kind: MEDIA_KIND.thumbnail, status: MEDIA_ASSET_STATUS.ready }, take: 1 },
    },
  });
  if (!source?.composition?.currentRevisionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (
    !canAccessSticker(source, { viewerId: user.id, isAdmin })
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourceRev = await prisma.compositionRevision.findUnique({
    where: { id: source.composition.currentRevisionId },
  });
  if (!sourceRev) {
    return NextResponse.json({ error: "Missing source revision" }, { status: 404 });
  }

  let doc;
  try {
    doc = remixDocument(parseDocumentJson(sourceRev.documentJson));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid source document" },
      { status: 400 },
    );
  }

  const title = `Remix of ${source.title}`.slice(0, 200);
  const slug = await uniqueStickerSlug(title);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const s = await tx.sticker.create({
        data: {
          title,
          description: source.description,
          slug,
          createdById: user.id,
          uploadedById: user.id,
          remixedFromStickerId: source.id,
          categoryId: source.categoryId,
          authorName: source.authorName,
          sourceUrl: source.sourceUrl,
          visibility:
            source.visibility === VISIBILITY.private
              ? VISIBILITY.private
              : VISIBILITY.unlisted,
          moderationStatus: MODERATION_STATUS.draft,
          processingStatus: PROCESSING_STATUS.processing,
        },
      });

      const composition = await tx.composition.create({
        data: { stickerId: s.id, ownerId: user.id },
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

      await tx.compositionParent.create({
        data: {
          compositionId: composition.id,
          parentCompositionId: source.composition!.id,
          sortOrder: 0,
        },
      });

      return { sticker: s, composition, revision };
    });

    await recordModerationEvent({
      subjectType: MODERATION_SUBJECT.sticker,
      subjectId: created.sticker.id,
      subjectTitle: created.sticker.title,
      action: MODERATION_ACTION.submitted,
      actorId: user.id,
      note: `Remix of sticker ${source.id}`,
    });

    enqueueCompositionEncode(created.sticker.id);

    return NextResponse.json({
      ok: true,
      id: created.sticker.id.toString(),
      slug: created.sticker.slug,
      document: doc,
      parentCompositionId: source.composition.id.toString(),
      remixedFromStickerId: source.id.toString(),
    });
  } catch (err) {
    console.error("Remix failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Remix failed" },
      { status: 502 },
    );
  }
}
