/** Shared banner/avatar targets — client + server. */

export const BLOBBER_IMAGE = {
  banner: {
    width: 1707,
    height: 282,
    maxBytes: Math.floor(0.3 * 1024 * 1024), // 0.3 MiB
  },
  avatar: {
    width: 120,
    height: 120,
    maxBytes: Math.floor(0.1 * 1024 * 1024), // 0.1 MiB
  },
} as const;

export type BlobberImageKind = keyof typeof BLOBBER_IMAGE;

/** Raw upload ceiling before processing (user may pick large phone photos). */
export const BLOBBER_IMAGE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export function blobberImageHint(kind: BlobberImageKind): string {
  if (kind === "banner") {
    return `Auto-cropped to ${BLOBBER_IMAGE.banner.width}×${BLOBBER_IMAGE.banner.height} and compressed under 0.3 MB. Any photo works.`;
  }
  return `Auto-cropped to a 1:1 square (${BLOBBER_IMAGE.avatar.width}×${BLOBBER_IMAGE.avatar.height}) and compressed under 0.1 MB. Any photo works.`;
}
