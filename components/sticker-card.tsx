import Link from "next/link";
import { Blender } from "lucide-react";
import { AttributionCredit } from "./attribution-credit";
import { AddToCollectionButton } from "./add-to-collection-button";
import { FavouriteButton } from "./favourite-button";
import { RemoveFromCollectionButton } from "./remove-from-collection-button";
import { StickerMedia } from "./sticker-media";

export type StickerCardProps = {
  title: string;
  author: string;
  sourceUrl?: string | null;
  type: string;
  href: string;
  thumbUrl?: string | null;
  status?: string | null;
  /** When set, show Remix icon button (member+). */
  remixHref?: string | null;
  /** Sticker id for favourite / collection actions. */
  stickerId?: string | null;
  favourited?: boolean;
  signedIn?: boolean;
  signInHref?: string;
  showActions?: boolean;
  /** Owner remove from this collection (min 1 sticker enforced by API). */
  collectionSlug?: string | null;
  canRemoveFromCollection?: boolean;
};

export function StickerCard({
  title,
  author,
  sourceUrl,
  type,
  href,
  thumbUrl,
  status,
  remixHref,
  stickerId,
  favourited = false,
  signedIn = false,
  signInHref,
  showActions = false,
  collectionSlug,
  canRemoveFromCollection = false,
}: StickerCardProps) {
  const actions = showActions && stickerId;

  return (
    <div className="group">
      <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-divider bg-surface transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-[1deg] group-hover:shadow-2xl group-hover:shadow-accent-pink/10">
        <Link href={href} className="absolute inset-0 block">
          <StickerMedia
            src={thumbUrl ?? null}
            seed={title}
            alt={title}
            video={type === "VIDEO"}
          />
        </Link>

        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
          {type}
        </div>

        {status ? (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary">
            {status.replaceAll("_", " ")}
          </div>
        ) : null}

        {collectionSlug && stickerId ? (
          <RemoveFromCollectionButton
            collectionSlug={collectionSlug}
            stickerId={stickerId}
            canRemove={canRemoveFromCollection}
          />
        ) : null}

        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-2">
          {actions ? (
            <>
              <FavouriteButton
                subjectType="sticker"
                subjectId={stickerId}
                initialFavourited={favourited}
                signedIn={signedIn}
                signInHref={signInHref}
                variant="icon"
              />
              <AddToCollectionButton
                stickerId={stickerId}
                signedIn={signedIn}
                signInHref={signInHref}
                variant="icon"
              />
            </>
          ) : null}
          {remixHref ? (
            <Link
              href={remixHref}
              title="Remix"
              aria-label="Remix"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-gradient text-white shadow-lg transition hover:scale-105"
            >
              <Blender className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>

        <Link
          href={href}
          className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        >
          <span className="p-4 text-xs font-semibold text-white">View sticker →</span>
        </Link>
      </div>

      <div className="px-1 pt-3">
        <Link href={href} className="block truncate text-sm font-semibold hover:text-accent-pink">
          {title}
        </Link>
        <AttributionCredit
          label={author}
          sourceUrl={sourceUrl}
          showInfo={!!sourceUrl}
          className="mt-0.5"
        />
      </div>
    </div>
  );
}
