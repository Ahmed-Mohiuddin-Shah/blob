import {
  BLOBBER_IMAGE,
  type BlobberImageKind,
} from "@/lib/blobber-image-spec";

/** Browser cover-crop + JPEG compress toward target size/bytes. */
export async function prepareBlobberImageClient(
  file: File,
  kind: BlobberImageKind,
): Promise<File> {
  const spec = BLOBBER_IMAGE[kind];
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    const scale = Math.max(
      spec.width / bitmap.width,
      spec.height / bitmap.height,
    );
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    const dx = (spec.width - dw) / 2;
    const dy = (spec.height - dh) / 2;
    ctx.drawImage(bitmap, dx, dy, dw, dh);

    let quality = 0.88;
    let blob = await canvasToJpeg(canvas, quality);
    while (blob.size > spec.maxBytes && quality > 0.35) {
      quality -= 0.08;
      blob = await canvasToJpeg(canvas, quality);
    }

    return new File([blob], `${kind}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}
