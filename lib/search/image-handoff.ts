const KEY = "blob:search:image";

/** Match server `visionImageBase64` max edge (CLIP / vision payloads). */
const SEARCH_IMAGE_MAX_EDGE = 512;

/** Raw GIF/video upload cap for search (base64 expands ~4/3). */
const SEARCH_MOTION_MAX_BYTES = 8 * 1024 * 1024;

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

export function isSearchMediaFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  return t.startsWith("image/") || t.startsWith("video/");
}

/** GIF / video / animated webp — send raw bytes so server can storyboard. */
export function isMotionSearchFile(file: File): boolean {
  const t = (file.type || "").toLowerCase().split(";")[0]!.trim();
  return (
    t === "image/gif" ||
    t === "image/webp" ||
    t.startsWith("video/")
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const data = dataUrl.split(",")[1] ?? "";
      if (!data) reject(new Error("encode failed"));
      else resolve(data);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Browser: fit inside 512px as JPEG base64 for Meili visual search. */
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

/**
 * Search upload: stills → 512 JPEG; GIF/video → raw base64 + original mime
 * so the server can build a 6-frame storyboard.
 */
export async function fileToSearchMedia(file: File): Promise<ImageHandoff> {
  if (!isSearchMediaFile(file)) {
    throw new Error("Pick an image, GIF, or video");
  }
  if (isMotionSearchFile(file)) {
    if (file.size > SEARCH_MOTION_MAX_BYTES) {
      throw new Error("File too large for visual search (max 8MB)");
    }
    const data = await fileToBase64(file);
    return {
      mime: file.type.split(";")[0]!.trim() || "application/octet-stream",
      data,
      name: file.name,
    };
  }
  return fileToHandoff(file);
}
