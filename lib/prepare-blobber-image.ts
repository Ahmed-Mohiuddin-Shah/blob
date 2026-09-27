import sharp from "sharp";
import {
  BLOBBER_IMAGE,
  BLOBBER_IMAGE_UPLOAD_MAX_BYTES,
  type BlobberImageKind,
} from "@/lib/blobber-image-spec";

/**
 * Cover-crop to target size and JPEG-compress under kind maxBytes.
 * App-side — callers may also prep on the client; this is the SoT.
 */
export async function prepareBlobberImage(
  input: Uint8Array,
  kind: BlobberImageKind,
): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  if (input.length === 0) throw new Error("Empty file");
  if (input.length > BLOBBER_IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("File too large (max 20 MiB before processing)");
  }

  const spec = BLOBBER_IMAGE[kind];
  const buf = Buffer.from(input);
  const pipeline = () =>
    sharp(buf).rotate().resize(spec.width, spec.height, {
      fit: "cover",
      position: "centre",
    });

  let quality = 88;
  let out = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();
  while (out.length > spec.maxBytes && quality > 40) {
    quality -= 8;
    out = await pipeline().jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  if (out.length > spec.maxBytes) {
    out = await pipeline()
      .jpeg({ quality: 35, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  if (out.length > spec.maxBytes) {
    throw new Error(
      kind === "banner"
        ? "Could not compress banner under 0.3 MB"
        : "Could not compress profile image under 0.1 MB",
    );
  }

  return { bytes: new Uint8Array(out), mime: "image/jpeg", ext: "jpg" };
}
