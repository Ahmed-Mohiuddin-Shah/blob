import Link from "next/link";
import { Layers } from "lucide-react";

export type CollectionCardProps = {
  name: string;
  href: string;
  author: string;
  stickerCount: number;
  tags?: { name: string }[];
  favourited?: boolean;
};

export function CollectionCard({
  name,
  href,
  author,
  stickerCount,
  tags = [],
}: CollectionCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-[2rem] border border-divider bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent-pink/10"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-gradient text-white shadow-md shadow-accent-pink/20">
        <Layers className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="mt-4 truncate text-base font-semibold group-hover:text-accent-pink">
        {name}
      </h2>
      <p className="mt-1 text-xs text-secondary">
        {stickerCount} sticker{stickerCount === 1 ? "" : "s"} · {author}
      </p>
      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((t) => (
            <li
              key={t.name}
              className="rounded-full border border-divider bg-background px-2 py-0.5 text-[10px] font-semibold text-secondary"
            >
              {t.name}
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  );
}
