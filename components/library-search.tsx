"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CategoryPills, type CategoryPill } from "./category-pills";

type Props = {
  categories: CategoryPill[];
  initialQ?: string;
  initialCategory?: string;
  docked: boolean;
};

export function LibrarySearch({
  categories,
  initialQ = "",
  initialCategory,
  docked,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (initialCategory) params.set("category", initialCategory);
    const qs = params.toString();
    router.push(qs ? `/stickers?${qs}` : "/stickers");
  }

  const form = (
    <form onSubmit={submit} className={docked ? "w-full max-w-md" : "mx-auto max-w-2xl"}>
      <div
        className={`group relative flex items-center rounded-full border border-divider bg-surface shadow-xl shadow-black/5 transition-all duration-300 focus-within:border-accent-pink/50 focus-within:shadow-2xl focus-within:shadow-accent-pink/10 ${
          docked ? "p-1" : "p-2"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center text-inactive ${
            docked ? "h-9 w-9" : "h-12 w-12"
          }`}
        >
          <Search className={docked ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.75} aria-hidden />
        </div>
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search cats, reactions, memes..."
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-inactive ${
            docked ? "px-1 text-sm" : "px-2 text-base"
          }`}
          autoComplete="off"
        />
        {!docked ? (
          <button
            type="submit"
            className="hidden rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-accent-pink/20 transition-transform duration-200 hover:scale-[1.03] sm:block"
          >
            Search
          </button>
        ) : null}
      </div>
    </form>
  );

  if (docked) {
    return form;
  }

  return (
    <div>
      {form}
      <CategoryPills
        categories={categories}
        activeSlug={initialCategory}
        className="mt-5 justify-center"
      />
    </div>
  );
}

/** Observes a sentinel; reports when the hero search has scrolled out. */
export function useSearchDock(sentinelRef: React.RefObject<HTMLElement | null>) {
  const [docked, setDocked] = useState(false);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    if (!entry) return;
    setDocked(!entry.isIntersecting);
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, {
      rootMargin: "-80px 0px 0px 0px",
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [sentinelRef, onIntersect]);

  return docked;
}

export function LibrarySearchSentinel({
  sentinelRef,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return <div ref={sentinelRef} className="h-px w-full" aria-hidden />;
}
