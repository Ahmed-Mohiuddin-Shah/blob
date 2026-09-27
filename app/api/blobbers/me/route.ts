import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  BLOBBER_REQUEST_STATUS,
  ensureLinkedBlobber,
  liveCmsSnapshot,
  parseCmsPayload,
} from "@/lib/blobbers";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

/** GET linked Blobber + pending edit status. */
export async function GET() {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blobber = await ensureLinkedBlobber(user.id, {
    displayName: user.displayName,
    username: user.username,
  });

  const full = await prisma.blobber.findUniqueOrThrow({
    where: { id: blobber.id },
    include: { socialLinks: { include: { socialLink: true } } },
  });

  const pending = await prisma.blobberEditRequest.findFirst({
    where: {
      blobberId: blobber.id,
      status: {
        in: [BLOBBER_REQUEST_STATUS.pending, BLOBBER_REQUEST_STATUS.needsEdit],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    id: full.id.toString(),
    live: liveCmsSnapshot(full),
    pendingRequest: pending
      ? {
          id: pending.id.toString(),
          status: pending.status,
          adminNote: pending.adminNote,
          proposedPayload: pending.proposedPayload,
        }
      : null,
  });
}

/** Submit CMS edit request (does not mutate live). */
export async function PATCH(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blobber = await ensureLinkedBlobber(user.id, {
    displayName: user.displayName,
    username: user.username,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = parseCmsPayload(body);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const open = await prisma.blobberEditRequest.findFirst({
    where: {
      blobberId: blobber.id,
      status: BLOBBER_REQUEST_STATUS.pending,
    },
  });
  if (open) {
    return NextResponse.json(
      { error: "You already have a pending profile edit" },
      { status: 409 },
    );
  }

  const needsEdit = await prisma.blobberEditRequest.findFirst({
    where: {
      blobberId: blobber.id,
      status: BLOBBER_REQUEST_STATUS.needsEdit,
    },
    orderBy: { createdAt: "desc" },
  });

  let requestRow;
  const jsonPayload = payload as unknown as Prisma.InputJsonValue;

  if (needsEdit) {
    requestRow = await prisma.blobberEditRequest.update({
      where: { id: needsEdit.id },
      data: {
        proposedPayload: jsonPayload,
        status: BLOBBER_REQUEST_STATUS.pending,
        adminNote: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
  } else {
    requestRow = await prisma.blobberEditRequest.create({
      data: {
        blobberId: blobber.id,
        requesterId: user.id,
        proposedPayload: jsonPayload,
        status: BLOBBER_REQUEST_STATUS.pending,
      },
    });
  }

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.blobberEditRequest,
    subjectId: requestRow.id,
    subjectTitle: payload.displayName,
    action: needsEdit
      ? MODERATION_ACTION.resubmitted
      : MODERATION_ACTION.submitted,
    actorId: user.id,
  });

  return NextResponse.json({ ok: true, id: requestRow.id.toString() });
}
