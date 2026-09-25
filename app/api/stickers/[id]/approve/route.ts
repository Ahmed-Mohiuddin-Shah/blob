import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { discardNonCurrentRevisionMedia } from "@/lib/composition-encode";
import { getGlass, getPublicPrismId } from "@/lib/glass";
import {
  MODERATION_ACTION,
  MODERATION_STATUS,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { PROCESSING_STATUS, VISIBILITY } from "@/lib/stickers";

async function requireAdminUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !user ||
    !canModerate({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return null;
  }
  return user;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: { media: true },
  });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sticker.moderationStatus === MODERATION_STATUS.approved) {
    return NextResponse.json({ ok: true, status: MODERATION_STATUS.approved });
  }
  if (sticker.processingStatus !== PROCESSING_STATUS.ready) {
    return NextResponse.json(
      { error: "Still processing — wait until ready" },
      { status: 409 },
    );
  }

  try {
    if (sticker.visibility === VISIBILITY.public) {
      const glass = getGlass();
      const publicId = await getPublicPrismId();
      for (const asset of sticker.media) {
        if (asset.glassPrismId === publicId) continue;
        await glass.prisms.linkObject(publicId, asset.glassObjectId);
        if (asset.glassPrismId !== publicId) {
          try {
            await glass.prisms.unlinkObject(asset.glassPrismId, asset.glassObjectId);
          } catch {
            // ponytail: unlink best-effort; object may stay on private prism too
          }
        }
        await prisma.mediaAsset.update({
          where: { id: asset.id },
          data: { glassPrismId: publicId },
        });
      }
    }

    await prisma.sticker.update({
      where: { id: sticker.id },
      data: {
        moderationStatus: MODERATION_STATUS.approved,
        moderationNote: null,
        publishedAt: sticker.publishedAt ?? new Date(),
      },
    });

    // Discard prior-revision derivative previews so history stays lean.
    await discardNonCurrentRevisionMedia(sticker.id);

    await recordModerationEvent({
      subjectType: MODERATION_SUBJECT.sticker,
      subjectId: sticker.id,
      subjectTitle: sticker.title,
      action: MODERATION_ACTION.approved,
      actorId: admin.id,
    });

    return NextResponse.json({ ok: true, status: MODERATION_STATUS.approved });
  } catch (err) {
    console.error("Approve sticker failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 502 },
    );
  }
}
