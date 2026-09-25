import Link from "next/link";
import { Layers } from "lucide-react";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { FavouriteButton } from "./favourite-button";
import { CollectionCollage } from "./collection-collage";

export type CollectionCardProps = {
  id?: string;
  name: string;
  href: string;
  author: string;
  stickerCount: number;
  tags?: { name: string }[];
  previewThumbUrls?: string[];
  favourited?: boolean;
  signedIn?: boolean;
  signInHref?: string;
  showActions?: boolean;
};

export function CollectionCard({
  id,
  name,
  href,
  author,
  stickerCount,
  previewThumbUrls = [],
  favourited = false,
  signedIn = false,
  signInHref,
  showActions = false,
}: CollectionCardProps) {
  const actions = showActions && id;

  return (
    <div className="group">
      <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-divider bg-surface transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-[1deg] group-hover:shadow-2xl group-hover:shadow-accent-pink/10">
        <Link href={href} className="absolute inset-0 block">
          <CollectionCollage
            urls={previewThumbUrls}
            seed={id ?? href}
            alt={name}
          />
        </Link>

        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
          Collection
        </div>

        <div className="pointer-events-none absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent-gradient text-white shadow-md shadow-accent-pink/20">
          <Layers className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>

        {actions ? (
          <div className="absolute bottom-3 right-3 z-10">
            <FavouriteButton
              subjectType={FAVORITE_SUBJECT.collection}
              subjectId={id}
              initialFavourited={favourited}
              signedIn={signedIn}
              signInHref={signInHref}
              variant="icon"
            />
          </div>
        ) : null}

        <Link
          href={href}
          className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <span className="p-4 text-xs font-semibold text-white">
            View collection →
          </span>
        </Link>
      </div>

      <div className="px-1 pt-3">
        <Link
          href={href}
          className="block truncate text-sm font-semibold hover:text-accent-pink"
        >
          {name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-secondary">
          {stickerCount} sticker{stickerCount === 1 ? "" : "s"} · {author}
        </p>
      </div>
    </div>
  );
}
