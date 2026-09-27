import { NextResponse } from "next/server";
import { BLOBBER_REQUEST_STATUS, ensureLinkedBlobber } from "@/lib/blobbers";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetIdRaw =
    typeof body.targetBlobberId === "string" ? body.targetBlobberId.trim() : "";
  if (!targetIdRaw) {
    return NextResponse.json({ error: "Target Blobber required" }, { status: 400 });
  }

  const target = await prisma.blobber.findUnique({
    where: { id: BigInt(targetIdRaw) },
  });
  if (!target) {
    return NextResponse.json({ error: "Blobber not found" }, { status: 404 });
  }
  if (target.userId != null && target.userId !== user.id) {
    return NextResponse.json(
      { error: "Blobber already linked to another account" },
      { status: 409 },
    );
  }

  await ensureLinkedBlobber(user.id, {
    displayName: user.displayName,
    username: user.username,
  });

  const existing = await prisma.blobberAssociationRequest.findFirst({
    where: {
      requesterId: user.id,
      targetBlobberId: target.id,
      status: BLOBBER_REQUEST_STATUS.pending,
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending request for this Blobber" },
      { status: 409 },
    );
  }

  const message =
    (typeof body.message === "string" ? body.message : "").trim().slice(0, 4000) ||
    null;

  const row = await prisma.blobberAssociationRequest.create({
    data: {
      requesterId: user.id,
      targetBlobberId: target.id,
      message,
      status: BLOBBER_REQUEST_STATUS.pending,
    },
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.blobberAssociationRequest,
    subjectId: row.id,
    subjectTitle: target.displayName,
    action: MODERATION_ACTION.submitted,
    actorId: user.id,
    note: message,
  });

  return NextResponse.json({ ok: true, id: row.id.toString() });
}
