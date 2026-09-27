"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SearchBar } from "@/components/search-bar";
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

  function submit(nextQ: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (initialCategory) params.set("category", initialCategory);
    const qs = params.toString();
    router.push(qs ? `/stickers?${qs}` : "/stickers");
  }

  const form = (
    <SearchBar
      variant="library"
      value={q}
      onChange={setQ}
      onSubmit={submit}
      showCamera
      hideSubmit={docked}
      placeholder="Search cats, reactions, memes..."
      className={docked ? "w-full max-w-md" : "mx-auto max-w-2xl"}
    />
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
