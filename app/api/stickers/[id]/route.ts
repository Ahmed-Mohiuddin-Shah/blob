import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  normalizeTagName,
  tagSlug,
  VISIBILITIES,
  type Visibility,
} from "@/lib/stickers";

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
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const wasNeedsEdit = sticker.moderationStatus === "needs_edit";
  const nextTitle = title ?? sticker.title;

  await prisma.$transaction(async (tx) => {
    await tx.sticker.update({
      where: { id: sticker.id },
      data: {
        ...(title !== null ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(wasNeedsEdit
          ? { moderationStatus: "pending_review", moderationNote: null }
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
    action: wasNeedsEdit
      ? MODERATION_ACTION.resubmitted
      : MODERATION_ACTION.edited,
    actorId: user.id,
  });

  return NextResponse.json({
    ok: true,
    status: wasNeedsEdit ? "pending_review" : sticker.moderationStatus,
  });
}
