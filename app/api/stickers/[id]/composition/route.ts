import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate, canUpload } from "@/lib/capabilities";
import {
  parseDocumentJson,
  upsertStillExports,
} from "@/lib/composition";
import { enqueueCompositionEncode } from "@/lib/composition-encode";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { ensurePrivatePrism } from "@/lib/private-prism";
import { canOwnerEditSticker } from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Save a new composition revision (document + optional still exports). */
export async function POST(
  request: Request,
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

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: { composition: { include: { revisions: { orderBy: { revision: "desc" }, take: 1 } } } },
  });
  if (!sticker?.composition) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner =
    sticker.uploadedById === user.id || sticker.createdById === user.id;
  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canOwnerEditSticker(sticker.moderationStatus)) {
    return NextResponse.json(
      { error: "Sticker is awaiting review and cannot be edited" },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const documentRaw = form.get("document");
  if (typeof documentRaw !== "string" || !documentRaw) {
    return NextResponse.json({ error: "document JSON required" }, { status: 400 });
  }
  let doc;
  try {
    doc = parseDocumentJson(JSON.parse(documentRaw));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid document" },
      { status: 400 },
    );
  }

  const lastRev = sticker.composition.revisions[0]?.revision ?? 0;
  const requeueReview =
    sticker.moderationStatus === "needs_edit" ||
    sticker.moderationStatus === "approved";

  try {
    const revision = await prisma.$transaction(async (tx) => {
      const rev = await tx.compositionRevision.create({
        data: {
          compositionId: sticker.composition!.id,
          revision: lastRev + 1,
          documentJson: doc as object,
          createdById: user.id,
        },
      });
      await tx.composition.update({
        where: { id: sticker.composition!.id },
        data: { currentRevisionId: rev.id },
      });
      await tx.sticker.update({
        where: { id: sticker.id },
        data: {
          processingStatus: "processing",
          processingError: null,
          ...(requeueReview
            ? { moderationStatus: "pending_review", moderationNote: null }
            : {}),
        },
      });
      return rev;
    });

    const chatFile = form.get("chat");
    const thumbFile = form.get("thumbnail");
    const fullFile = form.get("full");
    const maskFile = form.get("mask");
    if (
      chatFile instanceof File &&
      thumbFile instanceof File &&
      fullFile instanceof File
    ) {
      const prismId = await ensurePrivatePrism(user.id, user.glassPrivatePrismId);
      await upsertStillExports({
        stickerId: sticker.id,
        revisionId: revision.id,
        slug: sticker.slug,
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
      subjectId: sticker.id,
      subjectTitle: sticker.title,
      action: requeueReview
        ? MODERATION_ACTION.resubmitted
        : MODERATION_ACTION.edited,
      actorId: user.id,
    });

    enqueueCompositionEncode(sticker.id);

    return NextResponse.json({
      ok: true,
      revision: revision.revision,
      revisionId: revision.id.toString(),
    });
  } catch (err) {
    console.error("Composition save failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 502 },
    );
  }
}

/** GET current document for editor. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: {
      composition: true,
    },
  });
  if (!sticker?.composition?.currentRevisionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner =
    sticker.uploadedById === user.id || sticker.createdById === user.id;
  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canOwnerEditSticker(sticker.moderationStatus)) {
    return NextResponse.json(
      { error: "Sticker is awaiting review and cannot be edited" },
      { status: 409 },
    );
  }

  const revision = await prisma.compositionRevision.findUnique({
    where: { id: sticker.composition.currentRevisionId },
  });
  if (!revision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    document: revision.documentJson,
    revision: revision.revision,
    compositionId: sticker.composition.id.toString(),
  });
}
