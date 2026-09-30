"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BusyButton } from "./busy-button";
import { StickerMedia } from "./sticker-media";
import { TagPillsInput } from "./tag-pills-input";

export type SearchMetaItem = {
  id: string;
  title: string;
  slug: string;
  thumbUrl: string;
  live: { caption: string; scenario: string; tags: string[] };
  draft: { caption: string; scenario: string; tags: string[] } | null;
};

type View = "live" | "draft";

export function SearchMetaModerationList({ items }: { items: SearchMetaItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewById, setViewById] = useState<Record<string, View>>(() =>
    Object.fromEntries(
      items.map((i) => [i.id, i.draft ? ("draft" as View) : ("live" as View)]),
    ),
  );
  const [drafts, setDrafts] = useState<
    Record<string, { caption: string; scenario: string; tags: string[] }>
  >(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        i.draft ?? { caption: "", scenario: "", tags: [] as string[] },
      ]),
    ),
  );

  async function approve(id: string) {
    const d = drafts[id];
    if (!d) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/stickers/${id}/search-meta/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiCaption: d.caption,
          aiScenario: d.scenario,
          aiVisualTags: d.tags,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Approve failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function keepLive(id: string) {
    setBusyId(`keep-${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/stickers/${id}/search-meta/keep`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Keep live failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Keep live failed");
    } finally {
      setBusyId(null);
    }
  }

  async function retryEnrich(id: string) {
    setBusyId(`retry-${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/stickers/${id}/search-meta/retry`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Retry failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Retry failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) {
    return <p className="text-sm text-secondary">No search meta waiting.</p>;
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {items.map((item) => {
        const hasLive =
          Boolean(item.live.caption.trim()) ||
          Boolean(item.live.scenario.trim()) ||
          item.live.tags.length > 0;
        const view = viewById[item.id] ?? (item.draft ? "draft" : "live");
        const d = drafts[item.id] ?? {
          caption: "",
          scenario: "",
          tags: [] as string[],
        };
        const showingLive = view === "live" && hasLive;
        const caption = showingLive ? item.live.caption : d.caption;
        const scenario = showingLive ? item.live.scenario : d.scenario;
        const tags = showingLive ? item.live.tags : d.tags;

        return (
          <article
            key={item.id}
            className="rounded-[28px] border border-divider bg-surface p-4"
          >
            <div className="flex flex-wrap gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-2xl">
                <StickerMedia
                  src={item.thumbUrl}
                  seed={item.slug}
                  alt={item.title}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-primary">{item.title}</h3>
                  {hasLive && item.draft ? (
                    <div className="flex rounded-full border border-divider p-0.5 text-xs font-semibold uppercase tracking-wide">
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${
                          view === "live"
                            ? "bg-accent-gradient text-white"
                            : "text-inactive"
                        }`}
                        onClick={() =>
                          setViewById((p) => ({ ...p, [item.id]: "live" }))
                        }
                      >
                        Live
                      </button>
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${
                          view === "draft"
                            ? "bg-accent-gradient text-white"
                            : "text-inactive"
                        }`}
                        onClick={() =>
                          setViewById((p) => ({ ...p, [item.id]: "draft" }))
                        }
                      >
                        Draft
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wide text-inactive">
                      {item.draft ? "Draft" : "Live"}
                    </span>
                  )}
                </div>
                <label className="block text-xs text-inactive">
                  Caption
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-divider bg-transparent p-2 text-sm text-primary disabled:opacity-70"
                    rows={2}
                    value={caption}
                    disabled={showingLive}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...d, caption: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className="block text-xs text-inactive">
                  Scenario
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-divider bg-transparent p-2 text-sm text-primary disabled:opacity-70"
                    rows={2}
                    value={scenario}
                    disabled={showingLive}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.id]: { ...d, scenario: e.target.value },
                      }))
                    }
                  />
                </label>
                <div className="block text-xs text-inactive">
                  Visual tags
                  <div className="mt-1">
                    <TagPillsInput
                      value={tags}
                      onChange={(next) => {
                        if (showingLive) return;
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...d, tags: next },
                        }));
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BusyButton
                    type="button"
                    busy={busyId === item.id}
                    onClick={() => void approve(item.id)}
                    disabled={showingLive && !item.draft}
                    className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Approve draft
                  </BusyButton>
                  {hasLive ? (
                    <BusyButton
                      type="button"
                      busy={busyId === `keep-${item.id}`}
                      onClick={() => void keepLive(item.id)}
                      className="rounded-full border border-divider px-5 py-2 text-sm font-semibold text-primary"
                    >
                      Keep live
                    </BusyButton>
                  ) : null}
                  <BusyButton
                    type="button"
                    busy={busyId === `retry-${item.id}`}
                    onClick={() => void retryEnrich(item.id)}
                    className="rounded-full border border-divider px-5 py-2 text-sm font-semibold text-primary"
                  >
                    Regenerate
                  </BusyButton>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
