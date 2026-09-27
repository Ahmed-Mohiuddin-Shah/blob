import { BlobbersDirectory } from "@/components/blobbers-directory";

export default async function BlobbersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-wider text-inactive">
        Directory
      </p>
      <h1 className="mt-1 text-4xl font-light lowercase tracking-tight sm:text-5xl">
        blobbers
      </h1>
      <p className="mt-2 max-w-xl text-sm text-secondary">
        Public credit profiles — artists, remixers, and sources behind the stickers.
      </p>
      <div className="mt-10">
        <BlobbersDirectory initialQ={sp.q ?? ""} />
      </div>
    </section>
  );
}
