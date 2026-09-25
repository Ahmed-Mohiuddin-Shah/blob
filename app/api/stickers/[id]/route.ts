import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import {
  MODERATION_ACTION,
  MODERATION_STATUS,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  canAccessSticker,
  canOwnerEditSticker,
  normalizeTagName,
  tagSlug,
  VISIBILITIES,
  type Visibility,
} from "@/lib/stickers";
import { parseAttributionInput } from "@/lib/attribution";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Metadata-only edit. No media replacement. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
  });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner =
    sticker.uploadedById === user.id || sticker.createdById === user.id;
  if (
    !isOwner &&
    !(
      isAdmin &&
      canAccessSticker(sticker, { viewerId: user.id, isAdmin: true })
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canOwnerEditSticker(sticker.moderationStatus)) {
    return NextResponse.json(
      { error: "Sticker is awaiting review and cannot be edited" },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
  if (title !== null && !title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const description =
    typeof body.description === "string" ? body.description.trim() || null : undefined;

  const visibilityRaw =
    typeof body.visibility === "string" ? body.visibility.trim() : undefined;
  let visibility: Visibility | undefined;
  if (visibilityRaw !== undefined) {
    if (!VISIBILITIES.includes(visibilityRaw as Visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }
    visibility = visibilityRaw as Visibility;
  }

  let categoryId: bigint | null | undefined;
  if ("categoryId" in body) {
    const raw = body.categoryId;
    if (raw === null || raw === "") {
      categoryId = null;
    } else {
      const cat = await prisma.category.findUnique({
        where: { id: BigInt(String(raw)) },
      });
      if (!cat) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
      categoryId = cat.id;
    }
  }

  const tagsRaw = typeof body.tags === "string" ? body.tags : undefined;
  const tagNames =
    tagsRaw !== undefined
      ? tagsRaw
          .split(/[,#\n]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 20)
      : undefined;

  let authorName: string | null | undefined;
  let sourceUrl: string | null | undefined;
  if (typeof body.hasAttribution === "string") {
    const attribution = parseAttributionInput({
      hasAttribution: body.hasAttribution,
      authorName: typeof body.authorName === "string" ? body.authorName : "",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : "",
    });
    if ("error" in attribution) {
      return NextResponse.json({ error: attribution.error }, { status: 400 });
    }
    authorName = attribution.authorName;
    sourceUrl = attribution.sourceUrl;
  }

  const requeueReview =
    sticker.moderationStatus === MODERATION_STATUS.needsEdit ||
    sticker.moderationStatus === MODERATION_STATUS.approved;
  const nextTitle = title ?? sticker.title;

  await prisma.$transaction(async (tx) => {
    await tx.sticker.update({
      where: { id: sticker.id },
      data: {
        ...(title !== null ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(authorName !== undefined ? { authorName, sourceUrl } : {}),
        ...(requeueReview
          ? { moderationStatus: MODERATION_STATUS.pendingReview, moderationNote: null }
          : {}),
      },
    });

    if (tagNames !== undefined) {
      await tx.stickerTag.deleteMany({ where: { stickerId: sticker.id } });
      for (const name of tagNames) {
        const display = normalizeTagName(name);
        const tSlug = tagSlug(display);
        if (!tSlug || !display) continue;
        const tag = await tx.tag.upsert({
          where: { slug: tSlug },
          create: { slug: tSlug, name: display },
          update: { name: display },
        });
        await tx.stickerTag.create({
          data: { stickerId: sticker.id, tagId: tag.id },
        });
      }
    }
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.sticker,
    subjectId: sticker.id,
    subjectTitle: nextTitle,
    action: requeueReview
      ? MODERATION_ACTION.resubmitted
      : MODERATION_ACTION.edited,
    actorId: user.id,
  });

  return NextResponse.json({
    ok: true,
    status: requeueReview ? MODERATION_STATUS.pendingReview : sticker.moderationStatus,
  });
}
