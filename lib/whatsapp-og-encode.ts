import sharp from "sharp";

/** WhatsApp link-preview og:image cap (developers.facebook.com). */
export const WHATSAPP_OG_MAX_BYTES = 600_000;
export const WHATSAPP_OG_SIZE = 512;

/**
 * Resize full still → 512² JPEG under WhatsApp og:image 600KB cap.
 * Worker-safe (no prisma). Mirror of prepareBlobberImage quality ladder.
 */
export async function encodeWhatsAppOg(fullBytes: Uint8Array): Promise<{
  bytes: Uint8Array;
  mime: string;
  ext: string;
  width: number;
  height: number;
}> {
  if (fullBytes.length === 0) throw new Error("Empty image for WhatsApp OG");

  const buf = Buffer.from(fullBytes);
  const pipeline = () =>
    sharp(buf)
      .rotate()
      .resize(WHATSAPP_OG_SIZE, WHATSAPP_OG_SIZE, {
        fit: "cover",
        position: "centre",
      });

  let quality = 88;
  let out = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();
  while (out.length > WHATSAPP_OG_MAX_BYTES && quality > 40) {
    quality -= 8;
    out = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  if (out.length > WHATSAPP_OG_MAX_BYTES) {
    out = await pipeline()
      .jpeg({ quality: 35, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  if (out.length > WHATSAPP_OG_MAX_BYTES) {
    throw new Error(
      `WhatsApp OG JPEG ${out.length} bytes exceeds ${WHATSAPP_OG_MAX_BYTES}`,
    );
  }

  return {
    bytes: new Uint8Array(out),
    mime: "image/jpeg",
    ext: "jpg",
    width: WHATSAPP_OG_SIZE,
    height: WHATSAPP_OG_SIZE,
  };
}
