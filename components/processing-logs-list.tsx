"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

type LogItem = {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectTitle: string;
  message: string;
  createdAt: string;
};

export function ProcessingLogsList({ initialQ }: { initialQ: string }) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(initialQ);
  const [draft, setDraft] = useState(initialQ);
  const [items, setItems] = useState<LogItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean, query: string) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/processing-logs?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = (await res.json()) as {
        items: LogItem[];
        nextCursor: string | null;
      };
      setItems((prev) => (replace ? json.items : [...prev, ...json.items]));
      setCursor(json.nextCursor);
    },
    [],
  );

  useEffect(() => {
    setQ(initialQ);
    setDraft(initialQ);
    setLoading(true);
    setError(null);
    fetchPage(null, true, initialQ)
      .catch(() => setError("Could not load logs"))
      .finally(() => setLoading(false));
  }, [fetchPage, initialQ]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        fetchPage(cursor, false, q)
          .catch(() => setError("Could not load more"))
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, fetchPage, q, loadingMore]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    setQ(next);
    setLoading(true);
    setError(null);
    fetchPage(null, true, next)
      .catch(() => setError("Could not load logs"))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <form onSubmit={submit} className="max-w-md">
        <div className="flex items-center rounded-full border border-divider bg-surface p-1">
          <div className="flex h-9 w-9 items-center justify-center text-inactive">
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search title, message, type…"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-accent-gradient px-4 py-1.5 text-xs font-semibold text-white"
          >
            Search
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-secondary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 py-10 text-center text-sm text-secondary">
          No processing logs yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((e) => (
            <li
              key={e.id}
              className="rounded-[1.5rem] border border-divider bg-surface px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  <span className="text-accent-orange">{e.subjectType}</span>
                  {" · "}
                  {e.subjectTitle}
                </p>
                <time className="text-xs text-inactive">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-secondary">#{e.subjectId}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs text-accent-orange">
                {e.message}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div ref={loadMoreRef} className="h-8" aria-hidden />
      {loadingMore ? (
        <p className="py-2 text-center text-xs text-secondary">Loading more…</p>
      ) : null}
    </div>
  );
}
