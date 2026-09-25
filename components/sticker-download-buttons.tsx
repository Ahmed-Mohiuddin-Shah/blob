import { Download } from "lucide-react";
import { glassPublicObjectUrl } from "@/lib/glass";

const DOWNLOAD_KINDS: { kind: string; label: string }[] = [
  { kind: "image", label: "Full PNG" },
  { kind: "chat", label: "Chat PNG" },
  { kind: "thumbnail", label: "Thumbnail" },
  { kind: "gif", label: "GIF" },
  { kind: "video", label: "Video" },
  { kind: "mask", label: "Mask" },
];

export type DownloadMedia = {
  kind: string;
  status: string;
  glassObjectId: string;
};

/** Download links: public stickers → direct GLASS object URL; else Blob media proxy. */
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
    media.filter((m) => m.status === "ready").map((m) => [m.kind, m]),
  );
  const items = DOWNLOAD_KINDS.filter((d) => ready.has(d.kind));
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
        Downloads
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map(({ kind, label }) => {
          const asset = ready.get(kind)!;
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
