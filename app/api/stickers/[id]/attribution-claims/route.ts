import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import {
  CLAIM_REASONS,
  isHttpUrl,
  type ClaimReason,
} from "@/lib/attribution";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { canAccessSticker } from "@/lib/stickers";
import { canModerate } from "@/lib/capabilities";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Signed-in user submits an attribution claim on a sticker. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.accountStatus !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const sticker = await prisma.sticker.findUnique({ where: { id: BigInt(id) } });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (!canAccessSticker(sticker, { viewerId: user.id, isAdmin })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!CLAIM_REASONS.includes(reasonRaw as ClaimReason)) {
    return NextResponse.json(
      { error: "Reason must be missing or mislabeled" },
      { status: 400 },
    );
  }
  const reason = reasonRaw as ClaimReason;

  const contactName =
    (typeof body.contactName === "string" ? body.contactName : "").trim().slice(0, 200) ||
    user.displayName;
  const contactEmail =
    (typeof body.contactEmail === "string" ? body.contactEmail : "").trim().slice(0, 255) ||
    user.email;
  if (!contactName || !contactEmail.includes("@")) {
    return NextResponse.json({ error: "Contact name and email required" }, { status: 400 });
  }

  const proposedAuthorName = (
    typeof body.proposedAuthorName === "string" ? body.proposedAuthorName : ""
  )
    .trim()
    .slice(0, 200);
  const proposedSourceUrl = (
    typeof body.proposedSourceUrl === "string" ? body.proposedSourceUrl : ""
  )
    .trim()
    .slice(0, 2048);
  if (!proposedAuthorName) {
    return NextResponse.json({ error: "Proposed attribution label required" }, { status: 400 });
  }
  if (!isHttpUrl(proposedSourceUrl)) {
    return NextResponse.json(
      { error: "Proposed source link must be an http(s) URL" },
      { status: 400 },
    );
  }

  const message =
    (typeof body.message === "string" ? body.message : "").trim().slice(0, 4000) || null;

  const existing = await prisma.attributionClaim.findFirst({
    where: {
      stickerId: sticker.id,
      claimantId: user.id,
      status: "pending",
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending claim on this sticker" },
      { status: 409 },
    );
  }

  const claim = await prisma.attributionClaim.create({
    data: {
      stickerId: sticker.id,
      claimantId: user.id,
      reason,
      contactName,
      contactEmail,
      message,
      proposedAuthorName,
      proposedSourceUrl,
      status: "pending",
    },
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.attributionClaim,
    subjectId: claim.id,
    subjectTitle: `${sticker.title} · ${reason}`,
    action: MODERATION_ACTION.claimSubmitted,
    actorId: user.id,
    note: message,
  });

  return NextResponse.json({ ok: true, id: claim.id.toString() });
}
