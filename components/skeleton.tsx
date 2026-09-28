"use client";

import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/** Brand-tinted skeleton theme using --badge / surface tokens. */
export function BlobSkeletonTheme({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme
      baseColor="var(--badge)"
      highlightColor="var(--surface)"
      borderRadius="1.5rem"
    >
      {children}
    </SkeletonTheme>
  );
}

export { Skeleton };

/** One sticker/collection card placeholder (square media + title lines). */
export function StickerCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton
        className="!rounded-[2rem]"
        containerClassName="block aspect-square leading-none"
        height="100%"
        width="100%"
      />
      <div className="px-1 pt-3">
        <Skeleton height={14} width="80%" borderRadius="0.5rem" />
        <Skeleton
          className="mt-1"
          height={12}
          width="50%"
          borderRadius="0.5rem"
        />
      </div>
    </div>
  );
}

/** Grid matching StickerGrid / collections library columns. */
export function StickerGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:gap-5"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <StickerCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Favourites list row placeholder. */
export function FavouriteRowSkeleton() {
  return (
    <div
      className="flex items-center gap-4 rounded-[1.5rem] border border-divider bg-surface p-3"
      aria-hidden
    >
      <Skeleton
        width={64}
        height={64}
        borderRadius="1rem"
        containerClassName="leading-none"
      />
      <div className="min-w-0 flex-1">
        <Skeleton height={14} width="60%" borderRadius="0.5rem" />
        <Skeleton
          className="mt-1"
          height={12}
          width="35%"
          borderRadius="0.5rem"
        />
      </div>
    </div>
  );
}

export function FavouritesListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="mt-8 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <FavouriteRowSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Print card grid (3/4 aspect). */
export function PrintGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="!rounded-[1.5rem]"
          containerClassName="block aspect-[3/4] leading-none"
          height="100%"
          width="100%"
        />
      ))}
    </div>
  );
}

/** Compact square tiles (picker / blobber rail). */
export function SquareTileSkeleton({
  className = "aspect-square !rounded-[1.25rem]",
}: {
  className?: string;
}) {
  return (
    <Skeleton
      className={className}
      containerClassName="block aspect-square leading-none"
      height="100%"
      width="100%"
    />
  );
}
