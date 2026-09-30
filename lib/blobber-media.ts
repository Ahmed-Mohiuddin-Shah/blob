import { createHash } from "crypto";
import { getGlass, getPublicPrismId } from "@/lib/glass";
import { BLOBBER_IMAGE_UPLOAD_MAX_BYTES } from "@/lib/blobber-image-spec";
import { prepareBlobberImage } from "@/lib/prepare-blobber-image";

export type BlobberMediaKind = "banner" | "avatar";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function assertUploadable(bytes: Uint8Array, mime: string) {
  if (bytes.length === 0) throw new Error("Empty file");
  if (bytes.length > BLOBBER_IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("File too large (max 20 MiB before processing)");
  }
  const m = mime.toLowerCase();
  if (!ALLOWED.has(m) && m !== "application/octet-stream") {
    throw new Error("Use PNG, JPEG, WebP, or GIF");
  }
}

async function storePrepared(opts: {
  bytes: Uint8Array;
  kind: BlobberMediaKind;
  title?: string;
  objectId?: string;
}): Promise<string> {
  const glass = getGlass();
  const checksum = createHash("sha256").update(opts.bytes).digest("hex");

  const prismId = await getPublicPrismId();

  if (opts.objectId) {
    await glass.objects.putBytes({
      prismId,
      objectId: opts.objectId,
      file: opts.bytes,
      checksum,
      filename: `${opts.kind}.jpg`,
    });
    return opts.objectId;
  }

  const uploaded = await glass.objects.upload({
    prismId,
    file: opts.bytes,
    title: opts.title ?? `blobber-${opts.kind}`,
    filename: `${opts.kind}.jpg`,
    fileExtension: "jpg",
  });
  return uploaded.object_id;
}

/** Upload a new object into the public PRISM (for staging / first image). */
export async function uploadBlobberImage(opts: {
  bytes: Uint8Array;
  mime: string;
  kind: BlobberMediaKind;
  title?: string;
}): Promise<string> {
  assertUploadable(opts.bytes, opts.mime);
  const prepared = await prepareBlobberImage(opts.bytes, opts.kind);
  return storePrepared({
    bytes: prepared.bytes,
    kind: opts.kind,
    title: opts.title,
  });
}

/** Overwrite bytes of an existing Glass object (same UUID). */
export async function overwriteBlobberImage(opts: {
  objectId: string;
  bytes: Uint8Array;
  mime: string;
  kind: BlobberMediaKind;
}): Promise<void> {
  assertUploadable(opts.bytes, opts.mime);
  const prepared = await prepareBlobberImage(opts.bytes, opts.kind);
  await storePrepared({
    bytes: prepared.bytes,
    kind: opts.kind,
    objectId: opts.objectId,
  });
}

/**
 * On CMS approve: keep live object UUIDs stable.
 * If proposed id differs from live, copy proposed bytes into live UUID and delete proposed.
 * If live has no id, adopt proposed id.
 */
export async function mergeMediaIdsOnApprove(opts: {
  liveBannerId: string | null;
  liveAvatarId: string | null;
  proposedBannerId: string | null;
  proposedAvatarId: string | null;
}): Promise<{ bannerGlassObjectId: string | null; avatarGlassObjectId: string | null }> {
  const bannerGlassObjectId = await mergeOne(
    opts.liveBannerId,
    opts.proposedBannerId,
    "banner",
  );
  const avatarGlassObjectId = await mergeOne(
    opts.liveAvatarId,
    opts.proposedAvatarId,
    "avatar",
  );
  return { bannerGlassObjectId, avatarGlassObjectId };
}

async function mergeOne(
  liveId: string | null,
  proposedId: string | null,
  kind: BlobberMediaKind,
): Promise<string | null> {
  if (!proposedId) return null;
  if (!liveId || liveId === proposedId) return proposedId;

  const glass = getGlass();
  const res = await glass.objects.download(proposedId);
  if (!res.ok) {
    throw new Error(`Failed to read proposed ${kind} image`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Already processed at upload — copy bytes as-is into live UUID.
  await storePrepared({ objectId: liveId, bytes, kind });
  try {
    await glass.objects.delete(proposedId);
  } catch {
    /* ponytail: orphan cleanup best-effort */
  }
  return liveId;
}

/** Best-effort delete of staging objects that are not the live ids. */
export async function deleteStagingMedia(opts: {
  liveBannerId: string | null;
  liveAvatarId: string | null;
  proposedBannerId: string | null;
  proposedAvatarId: string | null;
}) {
  const glass = getGlass();
  for (const [live, proposed] of [
    [opts.liveBannerId, opts.proposedBannerId],
    [opts.liveAvatarId, opts.proposedAvatarId],
  ] as const) {
    if (proposed && proposed !== live) {
      try {
        await glass.objects.delete(proposed);
      } catch {
        /* ignore */
      }
    }
  }
}
