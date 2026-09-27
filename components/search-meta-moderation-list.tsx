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
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
};

export function SearchMetaModerationList({ items }: { items: SearchMetaItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { caption: string; scenario: string; tags: string[] }>
  >(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        {
          caption: i.aiCaption,
          scenario: i.aiScenario,
          tags: i.aiVisualTags,
        },
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
        const d = drafts[item.id] ?? {
          caption: "",
          scenario: "",
          tags: [] as string[],
        };
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
                <h3 className="font-semibold text-primary">{item.title}</h3>
                <label className="block text-xs text-inactive">
                  Caption
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-divider bg-transparent p-2 text-sm text-primary"
                    rows={2}
                    value={d.caption}
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
                    className="mt-1 w-full rounded-2xl border border-divider bg-transparent p-2 text-sm text-primary"
                    rows={2}
                    value={d.scenario}
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
                      value={d.tags}
                      onChange={(tags) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...d, tags },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BusyButton
                    type="button"
                    busy={busyId === item.id}
                    onClick={() => void approve(item.id)}
                    className="rounded-full bg-accent-gradient px-5 py-2 text-sm font-semibold text-white"
                  >
                    Approve search meta
                  </BusyButton>
                  <BusyButton
                    type="button"
                    busy={busyId === `retry-${item.id}`}
                    onClick={() => void retryEnrich(item.id)}
                    className="rounded-full border border-divider px-5 py-2 text-sm font-semibold text-primary"
                  >
                    Retry AI caption
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
