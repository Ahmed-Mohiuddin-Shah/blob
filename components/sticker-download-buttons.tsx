import { Download } from "lucide-react";
import { glassPublicObjectUrl } from "@/lib/glass";
import { MEDIA_ASSET_STATUS, MEDIA_KIND } from "@/lib/stickers";

const SIZE_KINDS = [
  MEDIA_KIND.image,
  MEDIA_KIND.chat,
  MEDIA_KIND.thumbnail,
] as const;

export type DownloadMedia = {
  kind: string;
  status: string;
  mimeType?: string | null;
  glassObjectId: string;
};

function labelFor(kind: string, mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  const isGif = m === "image/gif";
  const isVideo = m.startsWith("video/");
  if (kind === MEDIA_KIND.image) {
    if (isGif) return "Full GIF";
    if (isVideo) return "Full Video";
    return "Full";
  }
  if (kind === MEDIA_KIND.chat) {
    if (isGif) return "Chat GIF";
    if (isVideo) return "Chat Video";
    return "Chat";
  }
  if (kind === MEDIA_KIND.thumbnail) {
    if (isGif) return "Thumbnail GIF";
    if (isVideo) return "Thumbnail Video";
    return "Thumbnail";
  }
  return kind;
}

/** Download links: matrix size slots only (never og/storyboard). */
export function StickerDownloadButtons({
  stickerId,
  useGlassDirect,
  media,
}: {
  stickerId: string;
  /** True when approved + public (object linked into public PRISM). */
  useGlassDirect: boolean;
  media: DownloadMedia[];
}) {
  const ready = new Map(
    media
      .filter((m) => m.status === MEDIA_ASSET_STATUS.ready)
      .map((m) => [m.kind, m]),
  );
  const items = SIZE_KINDS.filter((k) => ready.has(k)).map((kind) => {
    const asset = ready.get(kind)!;
    return { kind, label: labelFor(kind, asset.mimeType), asset };
  });
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
        Downloads
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map(({ kind, label, asset }) => {
          const href = useGlassDirect
            ? glassPublicObjectUrl(asset.glassObjectId)
            : `/api/stickers/${stickerId}/media/${kind}`;
          return (
            <li key={kind}>
              <a
                href={href}
                download
                target={useGlassDirect ? "_blank" : undefined}
                rel={useGlassDirect ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-4 py-2 text-xs font-semibold transition hover:border-accent-pink/40"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-gradient text-white">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
