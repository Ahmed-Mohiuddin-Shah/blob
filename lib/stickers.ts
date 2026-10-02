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
  /** 2×3 frame storyboard for CLIP / vision enrich (gif/video). */
  storyboard: "storyboard",
  /** WhatsApp / social link-preview JPEG (hidden from downloads). */
  og: "og",
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

/** Derivative / prepared-original budgets (match blob-editor). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_GIF_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
/** Absolute ceiling for any single upload (video is largest). */
export const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES;
/** Host override for video; GIF/image keep blob-editor default (10s). */
export const MAX_VIDEO_DURATION_MS = 20_000;

/** Budget for a derivative slot from its MIME (matrix encode). */
export function maxBytesForMime(mime: string): number {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  if (m === "image/gif") return MAX_GIF_BYTES;
  if (m.startsWith("video/")) return MAX_VIDEO_BYTES;
  return MAX_IMAGE_BYTES;
}

export function maxDurationMsForKind(
  kind: string | null | undefined,
): number | undefined {
  return kind === "video" ? MAX_VIDEO_DURATION_MS : undefined;
}

/** Peek primary media kind from unvalidated composition JSON. */
export function primaryMediaKind(raw: unknown): DetectedKind | null {
  if (!raw || typeof raw !== "object") return null;
  const objects = (raw as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) return null;
  for (const o of objects) {
    if (!o || typeof o !== "object") continue;
    const obj = o as { type?: string; kind?: string };
    if (obj.type !== "media") continue;
    if (obj.kind === "image" || obj.kind === "gif" || obj.kind === "video") {
      return obj.kind;
    }
  }
  return null;
}

/** True when File/Blob looks like video (prepare / editor override). */
export function isVideoSource(source: File | Blob | string | undefined): boolean {
  if (!source || typeof source === "string") return false;
  const type = (source.type || "").toLowerCase();
  if (type.startsWith("video/")) return true;
  if (source instanceof File) {
    return /\.(mp4|webm|mov|m4v)$/i.test(source.name);
  }
  return false;
}

const STATIC_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const GIF_MIME = "image/gif";
const VIDEO_MIME = "video/mp4";

export type DetectedKind = "image" | "gif" | "video";

export function maxBytesForKind(kind: DetectedKind): number {
  if (kind === "gif") return MAX_GIF_BYTES;
  if (kind === "video") return MAX_VIDEO_BYTES;
  return MAX_IMAGE_BYTES;
}

export function mimeToExt(mime: string): string {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "video/mp4") return "mp4";
  return "png";
}

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

export type StickerTypeLabel = "IMAGE" | "GIF" | "VIDEO";

/** UI type from stored media kinds (video wins over gif). */
export function stickerTypeFromKinds(
  kinds: Iterable<string>,
): StickerTypeLabel {
  const set = kinds instanceof Set ? kinds : new Set(kinds);
  if (set.has(MEDIA_KIND.video)) return "VIDEO";
  if (set.has(MEDIA_KIND.gif)) return "GIF";
  return "IMAGE";
}

type PreviewMediaRow = { kind: string; status?: string | null };

function isReady(m: PreviewMediaRow): boolean {
  return !m.status || m.status === MEDIA_ASSET_STATUS.ready;
}

/**
 * Site detail preview kind: VIDEO → mp4; GIF → gif; else still.
 */
export function previewMediaKind(media: PreviewMediaRow[]): MediaKind {
  const kinds = media.filter(isReady).map((m) => m.kind);
  const type = stickerTypeFromKinds(kinds);
  if (type === "VIDEO" && kinds.includes(MEDIA_KIND.video)) return MEDIA_KIND.video;
  if (type === "GIF" && kinds.includes(MEDIA_KIND.gif)) return MEDIA_KIND.gif;
  if (type === "GIF" && kinds.includes(MEDIA_KIND.image)) return MEDIA_KIND.image;
  if (kinds.includes(MEDIA_KIND.thumbnail)) return MEDIA_KIND.thumbnail;
  if (kinds.includes(MEDIA_KIND.image)) return MEDIA_KIND.image;
  if (kinds.includes(MEDIA_KIND.chat)) return MEDIA_KIND.chat;
  return MEDIA_KIND.thumbnail;
}

/** Card/list preview URL — thumbnail slot (GIF for GIF/VIDEO after matrix encode). */
export function stickerPreviewUrl(
  stickerId: string | bigint,
  media: PreviewMediaRow[],
): string {
  const kinds = media.filter(isReady).map((m) => m.kind);
  const kind = kinds.includes(MEDIA_KIND.thumbnail)
    ? MEDIA_KIND.thumbnail
    : kinds.includes(MEDIA_KIND.gif)
      ? MEDIA_KIND.gif
      : kinds.includes(MEDIA_KIND.chat)
        ? MEDIA_KIND.chat
        : kinds.includes(MEDIA_KIND.image)
          ? MEDIA_KIND.image
          : MEDIA_KIND.thumbnail;
  return `/api/stickers/${stickerId}/media/${kind}`;
}

/** WhatsApp link-preview og:image caps (developers.facebook.com). Keep value in sync with lib/whatsapp-og-encode.ts — do not import that module here (sharp must stay server-only). */
export const WHATSAPP_OG_MAX_BYTES = 600_000;
export const WHATSAPP_OG_MIN_WIDTH = 300;

type OgMediaRow = {
  kind: string;
  status?: string | null;
  width?: number | null;
  sizeBytes?: number | bigint | null;
};

function ogWidth(m: OgMediaRow): number {
  if (m.width && m.width > 0) return m.width;
  // Known encode sizes when width wasn't stored.
  if (m.kind === MEDIA_KIND.image) return 1024;
  if (m.kind === MEDIA_KIND.gif || m.kind === MEDIA_KIND.og) return 512;
  return 0;
}

function meetsWhatsAppOg(m: OgMediaRow): boolean {
  const bytes = Number(m.sizeBytes ?? 0);
  return (
    ogWidth(m) >= WHATSAPP_OG_MIN_WIDTH &&
    bytes > 0 &&
    bytes <= WHATSAPP_OG_MAX_BYTES
  );
}

/**
 * Pick an existing media kind for WhatsApp og:image.
 * Prefer dedicated `og` (512 JPEG ≤600KB); else still image/gif under budget.
 * Never chat/thumbnail (under 300px) or video/mp4 (image slot on VIDEO stickers).
 */
export function whatsappOgImageKind(media: OgMediaRow[]): MediaKind | null {
  const ready = media.filter(isReady);
  const og = ready.find((m) => m.kind === MEDIA_KIND.og);
  if (og) return MEDIA_KIND.og;
  const hasVideo = ready.some((m) => m.kind === MEDIA_KIND.video);
  const image = ready.find((m) => m.kind === MEDIA_KIND.image);
  const gif = ready.find((m) => m.kind === MEDIA_KIND.gif);
  // VIDEO matrix: image/chat are mp4 — only gif (or dedicated og) is still-capable.
  if (!hasVideo && image && meetsWhatsAppOg(image)) return MEDIA_KIND.image;
  if (gif && meetsWhatsAppOg(gif)) return MEDIA_KIND.gif;
  if (!hasVideo && image) return MEDIA_KIND.image;
  if (gif) return MEDIA_KIND.gif;
  return null;
}

/** Whether the downloadable VIDEO has muxed audio; null if not a video sticker. */
export function videoHasAudio(
  media: { kind: string; hasAudio?: boolean | null; status?: string | null }[],
): boolean | null {
  if (stickerTypeFromKinds(media.map((m) => m.kind)) !== "VIDEO") return null;
  const row = media.find(
    (m) => m.kind === MEDIA_KIND.video && isReady(m),
  );
  if (!row) return null;
  return !!row.hasAudio;
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

/** View/media gate: approved private is owner/editor-only (admins lose access after approve). */
export function canAccessSticker(
  s: {
    visibility: string;
    moderationStatus: string;
    processingStatus: string;
    uploadedById: bigint;
    createdById: bigint;
    /** Linked user of credited Blobber, if loaded. */
    blobberUserId?: bigint | null;
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
  if (
    viewer.viewerId != null &&
    isStickerEditor(s, viewer.viewerId, s.blobberUserId ?? null)
  ) {
    return true;
  }
  if (viewer.isAdmin && s.moderationStatus !== MODERATION_STATUS.approved) {
    return true;
  }
  return false;
}

/**
 * Who may edit metadata/composition (still gated by canOwnerEditSticker):
 * uploader, creator, or the linked user of the credited Blobber.
 */
export function isStickerEditor(
  sticker: { uploadedById: bigint; createdById: bigint },
  viewerId: bigint,
  creditedBlobberUserId: bigint | null = null,
): boolean {
  if (
    viewerId === sticker.uploadedById ||
    viewerId === sticker.createdById
  ) {
    return true;
  }
  return (
    creditedBlobberUserId != null && creditedBlobberUserId === viewerId
  );
}

/** Owner/editor may edit metadata/composition only when approved or admin requested edits. */
export function canOwnerEditSticker(moderationStatus: string): boolean {
  return (
    moderationStatus === MODERATION_STATUS.approved ||
    moderationStatus === MODERATION_STATUS.needsEdit
  );
}
