"use client";

import { useCallback, useEffect, useState } from "react";
import { BusyButton } from "@/components/busy-button";

type EventItem = {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectTitle: string;
  action: string;
  note: string | null;
  createdAt: string;
  actor: { username: string; displayName: string };
};

const SUBJECT_FILTERS = [
  { value: "", label: "All" },
  { value: "sticker", label: "Stickers" },
  { value: "collection", label: "Collections" },
  { value: "sticker_pack", label: "Packs" },
  { value: "print_layout", label: "Layouts" },
] as const;

export function ModerationHistoryList() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [subjectType, setSubjectType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string | null, replace = false) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (subjectType) params.set("subjectType", subjectType);
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/moderation/events?${params}`);
        const json = (await res.json()) as {
          items?: EventItem[];
          nextCursor?: string | null;
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "Failed to load history");
          return;
        }
        setItems((prev) =>
          replace ? (json.items ?? []) : [...prev, ...(json.items ?? [])],
        );
        setNextCursor(json.nextCursor ?? null);
      } catch {
        setError("Failed to load history");
      } finally {
        setBusy(false);
      }
    },
    [subjectType],
  );

  useEffect(() => {
    void load(null, true);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUBJECT_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setSubjectType(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              subjectType === f.value
                ? "bg-accent-gradient text-white"
                : "border border-divider bg-surface text-secondary hover:border-accent-pink/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-accent-orange" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 && !busy ? (
        <p className="py-10 text-center text-sm text-secondary">No events yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <li
              key={e.id}
              className="rounded-[1.5rem] border border-divider bg-surface px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  <span className="text-accent-pink">
                    {e.action.replaceAll("_", " ")}
                  </span>
                  {" · "}
                  <span className="text-secondary">{e.subjectType}</span>
                  {" · "}
                  {e.subjectTitle}
                </p>
                <time className="text-xs text-inactive">
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-secondary">
                by {e.actor.displayName || e.actor.username}
                {e.subjectId ? ` · #${e.subjectId}` : ""}
              </p>
              {e.note ? (
                <p className="mt-2 text-xs text-accent-orange">{e.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <BusyButton
          type="button"
          busy={busy}
          onClick={() => void load(nextCursor)}
          className="rounded-full border border-divider bg-surface px-4 py-2 text-xs font-semibold text-secondary"
        >
          Load more
        </BusyButton>
      ) : null}
    </div>
  );
}
