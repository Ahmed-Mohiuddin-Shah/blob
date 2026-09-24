import Link from "next/link";
import { StickerMedia } from "./sticker-media";

export type StickerCardProps = {
  title: string;
  author: string;
  type: string;
  href: string;
  thumbUrl?: string | null;
  status?: string | null;
};

export function StickerCard({
  title,
  author,
  type,
  href,
  thumbUrl,
  status,
}: StickerCardProps) {
  return (
    <Link href={href} className="group">
      <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-divider bg-surface transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-[1deg] group-hover:shadow-2xl group-hover:shadow-accent-pink/10">
        <StickerMedia
          src={thumbUrl ?? null}
          seed={title}
          alt={title}
          video={type === "VIDEO"}
        />

        <div className="absolute right-3 top-3 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
          {type}
        </div>

        {status ? (
          <div className="absolute left-3 top-3 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary">
            {status.replaceAll("_", " ")}
          </div>
        ) : null}

        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="p-4 text-xs font-semibold text-white">View sticker →</span>
        </div>
      </div>

      <div className="px-1 pt-3">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 truncate text-xs text-secondary">by {author}</p>
      </div>
    </Link>
  );
}
