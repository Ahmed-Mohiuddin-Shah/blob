import { StickerGridSkeleton } from "@/components/skeleton";

export default function CollectionsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="flex min-h-[28vh] flex-col justify-end pb-8 pt-10 sm:min-h-[32vh] sm:pt-14">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
          Library
        </p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-5xl">
          Collections
        </h1>
      </div>
      <StickerGridSkeleton />
    </div>
  );
}
