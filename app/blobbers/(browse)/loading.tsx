import { StickerGridSkeleton } from "@/components/skeleton";

export default function BlobbersLoading() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-wider text-inactive">
        Directory
      </p>
      <h1 className="mt-1 text-4xl font-light lowercase tracking-tight sm:text-5xl">
        blobbers
      </h1>
      <div className="mt-10">
        <StickerGridSkeleton count={8} />
      </div>
    </section>
  );
}
