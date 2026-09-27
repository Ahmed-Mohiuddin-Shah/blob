/** Max edge for Ollama vision / CLIP search — keep in sync with image-handoff. */
const VISION_MAX_EDGE = 512;

/** Resize/decode any image bytes to JPEG base64 for Ollama `images: [...]`. */
export async function visionImageBase64(bytes: Buffer | Uint8Array): Promise<string> {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(Buffer.from(bytes))
    .rotate()
    .resize(VISION_MAX_EDGE, VISION_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return jpeg.toString("base64");
}
