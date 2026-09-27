import { NextResponse } from "next/server";
import {
  applyCmsPayload,
  parseCmsPayload,
} from "@/lib/blobbers";
import { canModerate } from "@/lib/capabilities";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

async function requireAdminUser() {
  const user = await sessionUser();
  if (
    !user ||
    !canModerate({ role: user.role, accountStatus: user.accountStatus })
  ) {
    return null;
  }
  return user;
}

/** Direct admin edit of an unlinked Blobber (full CMS, no change request). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const blobber = await prisma.blobber.findUnique({
    where: { id: BigInt(id) },
  });
  if (!blobber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (blobber.userId != null) {
    return NextResponse.json(
      { error: "Only unlinked Blobbers can be edited directly" },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  // Multipart: clear banner/avatar only (image replace uses /api/blobbers/media)
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const clearBanner = String(form.get("clearBanner") ?? "") === "1";
    const clearAvatar = String(form.get("clearAvatar") ?? "") === "1";
    if (!clearBanner && !clearAvatar) {
      return NextResponse.json({ error: "Nothing to clear" }, { status: 400 });
    }

    await prisma.blobber.update({
      where: { id: blobber.id },
      data: {
        ...(clearBanner ? { bannerGlassObjectId: null } : {}),
        ...(clearAvatar ? { avatarGlassObjectId: null } : {}),
      },
    });

    await recordModerationEvent({
      subjectType: MODERATION_SUBJECT.blobber,
      subjectId: blobber.id,
      subjectTitle: blobber.displayName,
      action: MODERATION_ACTION.edited,
      actorId: admin.id,
      note: `Admin cleared ${[clearBanner && "banner", clearAvatar && "avatar"].filter(Boolean).join(" & ")} (unlinked Blobber)`,
    });

    return NextResponse.json({ ok: true });
  }

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

  try {
    await applyCmsPayload(blobber.id, payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 400 },
    );
  }

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.blobber,
    subjectId: blobber.id,
    subjectTitle: payload.displayName,
    action: MODERATION_ACTION.edited,
    actorId: admin.id,
    note: "Admin direct full edit (unlinked Blobber)",
  });

  return NextResponse.json({ ok: true });
}
