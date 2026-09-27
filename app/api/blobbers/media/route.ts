import { NextResponse } from "next/server";
import {
  overwriteBlobberImage,
  uploadBlobberImage,
  type BlobberMediaKind,
} from "@/lib/blobber-media";
import { canModerate } from "@/lib/capabilities";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

/**
 * Upload banner/avatar image.
 * - Owner (staging): always new public object → put id in pending CMS payload.
 * - Admin live: overwrite existing live object UUID when present, else create.
 */
export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "").trim();
  if (kindRaw !== "banner" && kindRaw !== "avatar") {
    return NextResponse.json({ error: "kind must be banner or avatar" }, { status: 400 });
  }
  const kind = kindRaw as BlobberMediaKind;

  const mode = String(form.get("mode") ?? "staging").trim(); // staging | live
  const blobberIdRaw = String(form.get("blobberId") ?? "").trim();

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });

  try {
    if (mode === "live") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!blobberIdRaw) {
        return NextResponse.json({ error: "blobberId required" }, { status: 400 });
      }
      const blobber = await prisma.blobber.findUnique({
        where: { id: BigInt(blobberIdRaw) },
      });
      if (!blobber) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (blobber.userId != null) {
        return NextResponse.json(
          { error: "Direct image replace only for unlinked Blobbers" },
          { status: 403 },
        );
      }

      const existing =
        kind === "banner"
          ? blobber.bannerGlassObjectId
          : blobber.avatarGlassObjectId;

      let objectId: string;
      if (existing) {
        await overwriteBlobberImage({
          objectId: existing,
          bytes,
          mime,
          kind,
        });
        objectId = existing;
      } else {
        objectId = await uploadBlobberImage({ bytes, mime, kind });
        await prisma.blobber.update({
          where: { id: blobber.id },
          data:
            kind === "banner"
              ? { bannerGlassObjectId: objectId }
              : { avatarGlassObjectId: objectId },
        });
      }

      await recordModerationEvent({
        subjectType: MODERATION_SUBJECT.blobber,
        subjectId: blobber.id,
        subjectTitle: blobber.displayName,
        action: MODERATION_ACTION.edited,
        actorId: user.id,
        note: `Admin updated ${kind} image (unlinked Blobber)`,
      });

      return NextResponse.json({ ok: true, objectId, replaced: !!existing });
    }

    // staging — linked owner (or admin acting as helper on own linked)
    const linked = await prisma.blobber.findUnique({
      where: { userId: user.id },
    });
    if (!linked && !isAdmin) {
      return NextResponse.json({ error: "No linked Blobber" }, { status: 400 });
    }

    const objectId = await uploadBlobberImage({
      bytes,
      mime,
      kind,
      title: `blobber-${kind}-staging`,
    });
    return NextResponse.json({ ok: true, objectId, replaced: false });
  } catch (err) {
    console.error("Blobber media upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 },
    );
  }
}
