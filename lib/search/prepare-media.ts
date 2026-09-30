export type SearchMediaIn = { mime: string; data: string };

/** Storyboard motion mime → JPEG; stills pass through. */
export async function prepareSearchMedia(
  media?: SearchMediaIn | null,
): Promise<{
  media: SearchMediaIn | null;
  processedFromMotion: boolean;
}> {
  if (!media?.data || !media.mime) {
    return { media: null, processedFromMotion: false };
  }
  const { isMotionMime, storyboardBase64 } = await import(
    "@/lib/search/storyboard"
  );
  if (!isMotionMime(media.mime)) {
    return { media, processedFromMotion: false };
  }
  const jpegB64 = await storyboardBase64(
    Buffer.from(media.data, "base64"),
    media.mime,
  );
  return {
    media: { mime: "image/jpeg", data: jpegB64 },
    processedFromMotion: true,
  };
}

export function mediaKindLabel(mime: string | undefined | null): "still" | "gif" | "video" {
  const m = (mime ?? "").toLowerCase().split(";")[0]!.trim();
  if (m.startsWith("video/")) return "video";
  if (m === "image/gif") return "gif";
  if (m === "image/webp") return "gif";
  return "still";
}
