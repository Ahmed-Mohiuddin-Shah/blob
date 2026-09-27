import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import {
  BLOBBER_REQUEST_STATUS,
  parseCmsPayload,
} from "@/lib/blobbers";
import { deleteStagingMedia } from "@/lib/blobber-media";
import { canModerate } from "@/lib/capabilities";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

async function sessionAdmin() {
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
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await sessionAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let note = "";
  try {
    const body = (await request.json()) as { note?: string };
    note = (body.note ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!note) {
    return NextResponse.json({ error: "Admin note required" }, { status: 400 });
  }

  const { id } = await context.params;
  const editReq = await prisma.blobberEditRequest.findUnique({
    where: { id: BigInt(id) },
    include: {
      blobber: {
        select: {
          displayName: true,
          bannerGlassObjectId: true,
          avatarGlassObjectId: true,
        },
      },
    },
  });
  if (!editReq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (editReq.status !== BLOBBER_REQUEST_STATUS.pending) {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  const payload = parseCmsPayload(editReq.proposedPayload);
  if (!("error" in payload)) {
    await deleteStagingMedia({
      liveBannerId: editReq.blobber.bannerGlassObjectId,
      liveAvatarId: editReq.blobber.avatarGlassObjectId,
      proposedBannerId: payload.bannerGlassObjectId,
      proposedAvatarId: payload.avatarGlassObjectId,
    });
  }

  await prisma.blobberEditRequest.update({
    where: { id: editReq.id },
    data: {
      status: BLOBBER_REQUEST_STATUS.rejected,
      adminNote: note,
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.blobberEditRequest,
    subjectId: editReq.id,
    subjectTitle: editReq.blobber.displayName,
    action: MODERATION_ACTION.rejected,
    actorId: admin.id,
    note,
  });

  return NextResponse.json({ ok: true });
}
