import { Suspense } from "react";
import { SiteSearch } from "@/components/site-search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<div className="p-10 text-secondary">Loading search…</div>}>
      <SiteSearch initialQ={sp.q ?? ""} initialMode={sp.mode ?? "hybrid"} />
    </Suspense>
  );
}
