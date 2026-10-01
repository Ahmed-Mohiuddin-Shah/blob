import Link from "next/link";
import { Blender, Volume2, VolumeX } from "lucide-react";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { COLLECTION_ITEM } from "@/lib/collections";
import { AttributionCredit } from "./attribution-credit";
import { AddToCollectionButton } from "./add-to-collection-button";
import { FavouriteButton } from "./favourite-button";
import { RemoveFromCollectionButton } from "./remove-from-collection-button";
import { StickerMedia } from "./sticker-media";

export type StickerCardProps = {
  title: string;
  author: string;
  sourceUrl?: string | null;
  blobberHref?: string | null;
  type: string;
  href: string;
  thumbUrl?: string | null;
  status?: string | null;
  /** VIDEO only: whether downloadable mp4 has muxed audio. */
  hasAudio?: boolean | null;
  /** When set, show Remix icon button (member+). */
  remixHref?: string | null;
  /** Sticker id for favourite / collection actions. */
  stickerId?: string | null;
  favourited?: boolean;
  inCollection?: boolean;
  signedIn?: boolean;
  signInHref?: string;
  showActions?: boolean;
  /** Owner remove from this collection (min 1 sticker enforced by API). */
  collectionSlug?: string | null;
  canRemoveFromCollection?: boolean;
  /** Above-fold media priority for LCP. */
  priority?: boolean;
};

export function StickerCard({
  title,
  author,
  sourceUrl,
  blobberHref,
  type,
  href,
  thumbUrl,
  status,
  hasAudio = null,
  remixHref,
  stickerId,
  favourited = false,
  inCollection = false,
  signedIn = false,
  signInHref,
  showActions = false,
  collectionSlug,
  canRemoveFromCollection = false,
  priority = false,
}: StickerCardProps) {
  const actions = showActions && stickerId;
  const showSound = type === "VIDEO" && hasAudio !== null && hasAudio !== undefined;
  const SoundIcon = hasAudio ? Volume2 : VolumeX;

  return (
    <div className="group">
      <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-divider bg-surface transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-[1deg] group-hover:shadow-2xl group-hover:shadow-accent-pink/10">
        <Link href={href} className="absolute inset-0 block">
          <StickerMedia
            src={thumbUrl ?? null}
            seed={title}
            alt={title}
            priority={priority}
          />
        </Link>

        {/* z-20: StickerMedia paints at z-10 once loaded — without this the type pill vanishes. */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5">
          {showSound ? (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-badge text-foreground"
              title={hasAudio ? "Sound" : "No sound"}
              aria-label={hasAudio ? "Sound" : "No sound"}
            >
              <SoundIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
          ) : null}
          <div className="rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
            {type}
          </div>
        </div>

        {status ? (
          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-badge px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary">
            {status.replaceAll("_", " ")}
          </div>
        ) : null}

        {collectionSlug && stickerId ? (
          <RemoveFromCollectionButton
            collectionSlug={collectionSlug}
            subjectType={COLLECTION_ITEM.sticker}
            subjectId={stickerId}
            canRemove={canRemoveFromCollection}
          />
        ) : null}

        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
          {actions ? (
            <>
              <FavouriteButton
                subjectType={FAVORITE_SUBJECT.sticker}
                subjectId={stickerId}
                initialFavourited={favourited}
                signedIn={signedIn}
                signInHref={signInHref}
                variant="icon"
              />
              <AddToCollectionButton
                stickerId={stickerId}
                initialInCollection={inCollection}
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
              className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-gradient text-white shadow-lg transition hover:scale-105"
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
          blobberHref={blobberHref}
          showInfo={!!sourceUrl}
          className="mt-0.5"
        />
      </div>
    </div>
  );
}
