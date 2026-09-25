/** Shared sticker constants and small helpers. */

import { MODERATION_STATUS } from "@/lib/moderation";

export const VISIBILITY = {
  public: "public",
  unlisted: "unlisted",
  private: "private",
} as const;

export const VISIBILITIES = [
  VISIBILITY.public,
  VISIBILITY.unlisted,
  VISIBILITY.private,
] as const;
export type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

export const PROCESSING_STATUS = {
  processing: "processing",
  ready: "ready",
  failed: "failed",
} as const;

export type ProcessingStatus =
  (typeof PROCESSING_STATUS)[keyof typeof PROCESSING_STATUS];

export const MEDIA_KIND = {
  image: "image",
  chat: "chat",
  thumbnail: "thumbnail",
  mask: "mask",
  gif: "gif",
  video: "video",
  prevThumbnail: "prev_thumbnail",
} as const;

export type MediaKind = (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];

/** Browse/card preview kinds (repeated Prisma `kind: { in: … }` filter). */
export const CARD_MEDIA_KINDS = [
  MEDIA_KIND.thumbnail,
  MEDIA_KIND.image,
  MEDIA_KIND.gif,
  MEDIA_KIND.video,
] as const;

export const MEDIA_ASSET_STATUS = {
  pending: "pending",
  ready: "ready",
  failed: "failed",
} as const;

export type MediaAssetStatus =
  (typeof MEDIA_ASSET_STATUS)[keyof typeof MEDIA_ASSET_STATUS];

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const STATIC_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const GIF_MIME = "image/gif";
const VIDEO_MIME = "video/mp4";

export type DetectedKind = "image" | "gif" | "video";

export function slugify(value: string, max = 220): string {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return base || "sticker";
}

export function tagSlug(value: string): string {
  return slugify(value, 80);
}

/** Display name stored ALL CAPS on save (e.g. ANGRY CAT). */
export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 80);
}

/** MIME + magic-byte sniff. Returns null if unsupported. */
export function detectUpload(
  bytes: Uint8Array,
  declaredMime: string,
): { mime: string; ext: string; kind: DetectedKind } | null {
  const mime = declaredMime.toLowerCase().split(";")[0]!.trim();
  const sig = sniff(bytes);

  if (sig === "image/png" && (mime === "image/png" || mime === "application/octet-stream")) {
    return { mime: "image/png", ext: "png", kind: "image" };
  }
  if (
    sig === "image/jpeg" &&
    (mime === "image/jpeg" || mime === "image/jpg" || mime === "application/octet-stream")
  ) {
    return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  }
  if (sig === "image/webp" && (mime === "image/webp" || mime === "application/octet-stream")) {
    return { mime: "image/webp", ext: "webp", kind: "image" };
  }
  if (sig === "image/gif" && (mime === GIF_MIME || mime === "application/octet-stream")) {
    return { mime: GIF_MIME, ext: "gif", kind: "gif" };
  }
  if (sig === "video/mp4" && (mime === VIDEO_MIME || mime === "application/octet-stream")) {
    return { mime: VIDEO_MIME, ext: "mp4", kind: "video" };
  }

  if (STATIC_MIMES.has(mime) && (!sig || sig.startsWith("image/"))) {
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    return { mime: mime === "image/jpg" ? "image/jpeg" : mime, ext, kind: "image" };
  }
  if (mime === GIF_MIME) return { mime: GIF_MIME, ext: "gif", kind: "gif" };
  if (mime === VIDEO_MIME) return { mime: VIDEO_MIME, ext: "mp4", kind: "video" };

  return null;
}

function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return "video/mp4";
  }
  return null;
}

export function mediaTypeLabel(kind: string | null | undefined): string {
  if (kind === MEDIA_KIND.gif) return "GIF";
  if (kind === MEDIA_KIND.video) return "VIDEO";
  return "IMAGE";
}

export function isPublicBrowseable(s: {
  visibility: string;
  moderationStatus: string;
  processingStatus: string;
}): boolean {
  return (
    s.visibility === VISIBILITY.public &&
    s.moderationStatus === MODERATION_STATUS.approved &&
    s.processingStatus === PROCESSING_STATUS.ready
  );
}

/** View/media gate: approved private is owner-only (admins lose access after approve). */
export function canAccessSticker(
  s: {
    visibility: string;
    moderationStatus: string;
    processingStatus: string;
    uploadedById: bigint;
    createdById: bigint;
  },
  viewer: { viewerId: bigint | null; isAdmin: boolean },
): boolean {
  if (isPublicBrowseable(s)) return true;
  if (
    s.visibility === VISIBILITY.unlisted &&
    s.moderationStatus === MODERATION_STATUS.approved &&
    s.processingStatus === PROCESSING_STATUS.ready
  ) {
    return true;
  }
  const isOwner =
    viewer.viewerId !== null &&
    (viewer.viewerId === s.uploadedById || viewer.viewerId === s.createdById);
  if (isOwner) return true;
  if (viewer.isAdmin && s.moderationStatus !== MODERATION_STATUS.approved) {
    return true;
  }
  return false;
}

/** Owner may edit metadata/composition only when approved or admin requested edits. */
export function canOwnerEditSticker(moderationStatus: string): boolean {
  return (
    moderationStatus === MODERATION_STATUS.approved ||
    moderationStatus === MODERATION_STATUS.needsEdit
  );
}
