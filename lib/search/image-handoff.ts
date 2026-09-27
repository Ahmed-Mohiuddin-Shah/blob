const KEY = "blob:search:image";

/** Match server `visionImageBase64` max edge (CLIP / vision payloads). */
const SEARCH_IMAGE_MAX_EDGE = 512;

export type ImageHandoff = { mime: string; data: string; name?: string };

export function stashImageHandoff(payload: ImageHandoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function takeImageHandoff(): ImageHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as ImageHandoff;
  } catch {
    return null;
  }
}

/** Browser: fit inside 512px as JPEG base64 for Meili image search. */
export async function fileToHandoff(file: File): Promise<ImageHandoff> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      SEARCH_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const data = dataUrl.split(",")[1] ?? "";
    if (!data) throw new Error("jpeg encode failed");
    return { mime: "image/jpeg", data, name: file.name };
  } finally {
    bitmap.close();
  }
}
