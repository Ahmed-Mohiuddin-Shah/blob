import { NextResponse } from "next/server";
import {
  findBlobberByName,
  normalizeBlobberName,
} from "@/lib/blobbers";
import {
  overwriteBlobberImage,
  uploadBlobberImage,
} from "@/lib/blobber-media";
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

/** Direct admin edit of an unlinked Blobber (no change request). */
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

  // Multipart: optional displayName + banner/avatar files
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const displayNameRaw = String(form.get("displayName") ?? "").trim();
    const clearBanner = String(form.get("clearBanner") ?? "") === "1";
    const clearAvatar = String(form.get("clearAvatar") ?? "") === "1";
    const bannerFile = form.get("banner");
    const avatarFile = form.get("avatar");

    let displayName = blobber.displayName;
    if (displayNameRaw) {
      displayName = normalizeBlobberName(displayNameRaw);
      const clash = await findBlobberByName(displayName);
      if (clash && clash.id !== blobber.id) {
        return NextResponse.json(
          { error: "Display name already taken" },
          { status: 409 },
        );
      }
    }

    let bannerGlassObjectId = blobber.bannerGlassObjectId;
    let avatarGlassObjectId = blobber.avatarGlassObjectId;

    try {
      if (clearBanner) bannerGlassObjectId = null;
      if (clearAvatar) avatarGlassObjectId = null;

      if (bannerFile instanceof File && bannerFile.size > 0) {
        const bytes = new Uint8Array(await bannerFile.arrayBuffer());
        const mime = bannerFile.type || "image/png";
        if (bannerGlassObjectId) {
          await overwriteBlobberImage({
            objectId: bannerGlassObjectId,
            bytes,
            mime,
            kind: "banner",
          });
        } else {
          bannerGlassObjectId = await uploadBlobberImage({
            bytes,
            mime,
            kind: "banner",
          });
        }
      }

      if (avatarFile instanceof File && avatarFile.size > 0) {
        const bytes = new Uint8Array(await avatarFile.arrayBuffer());
        const mime = avatarFile.type || "image/png";
        if (avatarGlassObjectId) {
          await overwriteBlobberImage({
            objectId: avatarGlassObjectId,
            bytes,
            mime,
            kind: "avatar",
          });
        } else {
          avatarGlassObjectId = await uploadBlobberImage({
            bytes,
            mime,
            kind: "avatar",
          });
        }
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Media update failed" },
        { status: 502 },
      );
    }

    await prisma.blobber.update({
      where: { id: blobber.id },
      data: { displayName, bannerGlassObjectId, avatarGlassObjectId },
    });

    await recordModerationEvent({
      subjectType: MODERATION_SUBJECT.blobber,
      subjectId: blobber.id,
      subjectTitle: displayName,
      action: MODERATION_ACTION.edited,
      actorId: admin.id,
      note: "Admin direct edit (unlinked Blobber)",
    });

    return NextResponse.json({ ok: true });
  }

  // JSON: displayName only
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const displayName = normalizeBlobberName(
    typeof body.displayName === "string" ? body.displayName : "",
  );
  if (!displayName) {
    return NextResponse.json({ error: "Display name required" }, { status: 400 });
  }
  const clash = await findBlobberByName(displayName);
  if (clash && clash.id !== blobber.id) {
    return NextResponse.json(
      { error: "Display name already taken" },
      { status: 409 },
    );
  }

  await prisma.blobber.update({
    where: { id: blobber.id },
    data: { displayName },
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.blobber,
    subjectId: blobber.id,
    subjectTitle: displayName,
    action: MODERATION_ACTION.edited,
    actorId: admin.id,
    note: "Admin direct rename (unlinked Blobber)",
  });

  return NextResponse.json({ ok: true });
}
