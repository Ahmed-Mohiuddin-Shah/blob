"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  displayName: string;
  hasBanner: boolean;
  hasAvatar: boolean;
  href: string;
  updatedAt: string;
};

export function UnlinkedBlobbersAdmin() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/admin/blobbers?${params}`);
      if (!res.ok) throw new Error("fail");
      const json = (await res.json()) as { items: Item[] };
      setItems(json.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div>
      <form
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const next = String(fd.get("q") ?? "").trim();
          setQ(next);
          void load(next);
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search unlinked Blobbers…"
          className="w-full max-w-md rounded-full border border-divider bg-surface px-5 py-3 text-sm outline-none focus:border-accent-pink/50"
        />
      </form>

      {loading ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-secondary">No unlinked Blobbers.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] border border-divider bg-surface px-4 py-3 transition hover:border-accent-pink/40"
              >
                <div>
                  <p className="font-semibold">{item.displayName}</p>
                  <p className="text-[10px] text-inactive">
                    {item.hasAvatar ? "avatar" : "no avatar"}
                    {" · "}
                    {item.hasBanner ? "banner" : "no banner"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-accent-pink">
                  Edit →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
