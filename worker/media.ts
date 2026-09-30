/** Media constants for the encode worker — keep free of app/prisma imports. */

export const MEDIA_KIND = {
  image: "image",
  chat: "chat",
  thumbnail: "thumbnail",
  mask: "mask",
  gif: "gif",
  video: "video",
  storyboard: "storyboard",
  og: "og",
} as const;

/** Match lib/stickers.ts / blob-editor budgets. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_GIF_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
/** WhatsApp link-preview og:image cap. */
export const MAX_OG_BYTES = 600_000;

export function mimeToExt(mime: string): string {
  const m = mime.toLowerCase().split(";")[0]!.trim();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "video/mp4") return "mp4";
  return "png";
}
