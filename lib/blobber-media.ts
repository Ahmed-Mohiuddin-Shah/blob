import { createHash } from "crypto";
import { getGlass, getPublicPrismId } from "@/lib/glass";

export type BlobberMediaKind = "banner" | "avatar";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function validateBlobberImage(
  bytes: Uint8Array,
  mime: string,
): { error: string } | { mime: string; ext: string } {
  if (bytes.length === 0) return { error: "Empty file" };
  if (bytes.length > MAX_BYTES) return { error: "Image too large (max 8 MiB)" };
  const m = mime.toLowerCase();
  if (!ALLOWED.has(m)) {
    return { error: "Use PNG, JPEG, WebP, or GIF" };
  }
  const ext =
    m === "image/png"
      ? "png"
      : m === "image/webp"
        ? "webp"
        : m === "image/gif"
          ? "gif"
          : "jpg";
  return { mime: m, ext };
}

/** Upload a new object into the public PRISM (for staging / first image). */
export async function uploadBlobberImage(opts: {
  bytes: Uint8Array;
  mime: string;
  kind: BlobberMediaKind;
  title?: string;
}): Promise<string> {
  const checked = validateBlobberImage(opts.bytes, opts.mime);
  if ("error" in checked) throw new Error(checked.error);

  const prismId = await getPublicPrismId();
  const glass = getGlass();
  const uploaded = await glass.objects.upload({
    prismId,
    file: opts.bytes,
    title: opts.title ?? `blobber-${opts.kind}`,
    filename: `${opts.kind}.${checked.ext}`,
    fileExtension: checked.ext,
  });
  return uploaded.object_id;
}

/** Overwrite bytes of an existing Glass object (same UUID). */
export async function overwriteBlobberImage(opts: {
  objectId: string;
  bytes: Uint8Array;
  mime: string;
  kind: BlobberMediaKind;
}): Promise<void> {
  const checked = validateBlobberImage(opts.bytes, opts.mime);
  if ("error" in checked) throw new Error(checked.error);

  const glass = getGlass();
  const checksum = createHash("sha256").update(opts.bytes).digest("hex");
  await glass.objects.putBytes({
    objectId: opts.objectId,
    file: opts.bytes,
    checksum,
    filename: `${opts.kind}.${checked.ext}`,
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
  const mime = res.headers.get("content-type") || "image/png";
  await overwriteBlobberImage({ objectId: liveId, bytes, mime, kind });
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
