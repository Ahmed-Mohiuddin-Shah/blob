import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { CLAIM_STATUS } from "@/lib/attribution";
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

async function requireNote(request: Request): Promise<string | NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const note = (typeof body.note === "string" ? body.note : "").trim();
  if (!note) {
    return NextResponse.json({ error: "Admin note required" }, { status: 400 });
  }
  return note;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await sessionAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const noteOrErr = await requireNote(request);
  if (noteOrErr instanceof NextResponse) return noteOrErr;
  const note = noteOrErr;

  const { id } = await context.params;
  const claim = await prisma.attributionClaim.findUnique({
    where: { id: BigInt(id) },
    include: { sticker: { select: { id: true, title: true } } },
  });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (claim.status !== CLAIM_STATUS.pending) {
    return NextResponse.json({ error: "Claim already reviewed" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.sticker.update({
      where: { id: claim.stickerId },
      data: {
        authorName: claim.proposedAuthorName,
        sourceUrl: claim.proposedSourceUrl,
      },
    });
    await tx.attributionClaim.update({
      where: { id: claim.id },
      data: {
        status: CLAIM_STATUS.approved,
        adminNote: note,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.attributionClaim,
    subjectId: claim.id,
    subjectTitle: `${claim.sticker.title} · ${claim.reason}`,
    action: MODERATION_ACTION.claimApproved,
    actorId: admin.id,
    note,
  });

  return NextResponse.json({ ok: true });
}
