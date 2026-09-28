import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { discardNonCurrentRevisionMedia } from "@/lib/composition-encode";
import { linkMediaToPublicPrism } from "@/lib/glass";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { JOB_TYPE } from "@/lib/jobs/types";
import {
  MODERATION_ACTION,
  MODERATION_STATUS,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { SEARCH_META_STATUS } from "@/lib/search/constants";
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
      await linkMediaToPublicPrism(sticker.media);
    }

    const needsEnrich =
      sticker.searchMetaStatus === SEARCH_META_STATUS.none ||
      sticker.searchMetaStatus === SEARCH_META_STATUS.stale ||
      sticker.searchMetaStatus === SEARCH_META_STATUS.approved;

    await prisma.sticker.update({
      where: { id: sticker.id },
      data: {
        moderationStatus: MODERATION_STATUS.approved,
        moderationNote: null,
        publishedAt: sticker.publishedAt ?? new Date(),
        ...(needsEnrich
          ? { searchMetaStatus: SEARCH_META_STATUS.enriching }
          : {}),
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

    if (needsEnrich) {
      enqueueJob(JOB_TYPE.searchEnrich, sticker.id);
    }

    return NextResponse.json({ ok: true, status: MODERATION_STATUS.approved });
  } catch (err) {
    console.error("Approve sticker failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 502 },
    );
  }
}
