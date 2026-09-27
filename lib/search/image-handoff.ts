const KEY = "blob:search:image";

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

export async function fileToHandoff(file: File): Promise<ImageHandoff> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] || file.type || "image/png";
  return { mime, data, name: file.name };
}
