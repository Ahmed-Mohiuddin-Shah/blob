/** Max edge for Ollama vision / CLIP search — keep in sync with image-handoff. */
const VISION_MAX_EDGE = 512;

/** True for bytes sharp can treat as a still (png/jpeg/webp/gif). */
export function isVisionImageMime(mime: string | null | undefined): boolean {
  const m = (mime ?? "").toLowerCase().split(";")[0]!.trim();
  return (
    m === "image/png" ||
    m === "image/jpeg" ||
    m === "image/jpg" ||
    m === "image/webp" ||
    m === "image/gif"
  );
}

/** Resize/decode any image bytes to JPEG base64 for Ollama `images: [...]`. */
export async function visionImageBase64(
  bytes: Buffer | Uint8Array,
): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new Error("Empty image buffer for vision");
  }
  const sharp = (await import("sharp")).default;
  try {
    const jpeg = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return jpeg.toString("base64");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Vision image decode failed (${bytes.byteLength} bytes): ${msg}`,
    );
  }
}
