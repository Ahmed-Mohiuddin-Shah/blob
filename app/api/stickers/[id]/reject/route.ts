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
  purgeSticker,
  restoreStickerAfterRejectedEdit,
} from "@/lib/sticker-reject";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !admin ||
    !canModerate({ role: admin.role, accountStatus: admin.accountStatus })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    select: {
      id: true,
      title: true,
      publishedAt: true,
    },
  });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isEditReject = sticker.publishedAt != null;

  // History first so the action is auditable even if restore/purge fails mid-flight.
  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.sticker,
    subjectId: sticker.id,
    subjectTitle: sticker.title,
    action: MODERATION_ACTION.rejected,
    actorId: admin.id,
  });

  try {
    if (isEditReject) {
      await restoreStickerAfterRejectedEdit(sticker.id);
      return NextResponse.json({
        ok: true,
        status: MODERATION_STATUS.approved,
        restored: true,
      });
    }
    await purgeSticker(sticker.id);
    return NextResponse.json({ ok: true, status: MODERATION_STATUS.rejected });
  } catch (err) {
    console.error("Reject sticker failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reject failed" },
      { status: 502 },
    );
  }
}
