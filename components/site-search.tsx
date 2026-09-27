"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ImagePlus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { BusyButton } from "@/components/busy-button";
import { MeiliTypeahead } from "@/components/meili-typeahead";

type Hit = {
  index: string;
  id: string;
  slug?: string;
  title?: string;
  name?: string;
  displayName?: string;
  kind?: string;
  previewUrl?: string;
};

type Props = {
  initialQ?: string;
  initialMode?: string;
};

const MODES = [
  { id: "hybrid", label: "Hybrid" },
  { id: "keywords", label: "Keywords" },
  { id: "semantic", label: "Semantic" },
  { id: "image", label: "Image" },
  { id: "agent", label: "Agent" },
] as const;

function hrefFor(hit: Hit): string {
  if (hit.index === "stickers" && hit.slug) return `/stickers/${hit.slug}`;
  if (hit.index === "collections" && hit.slug) return `/collections/${hit.slug}`;
  if (hit.index === "prints" && hit.slug) {
    return hit.kind === "pack" ? `/packs/${hit.slug}` : `/sheets/${hit.slug}`;
  }
  if (hit.index === "blobbers") return `/blobbers/${hit.id}`;
  return "/search";
}

function labelFor(hit: Hit): string {
  return hit.title || hit.name || hit.displayName || hit.id;
}

export function SiteSearch({ initialQ = "", initialMode = "hybrid" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ || params.get("q") || "");
  const [mode, setMode] = useState(initialMode || params.get("mode") || "hybrid");
  const [hits, setHits] = useState<Hit[]>([]);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [engine, setEngine] = useState<string>("");
  const [suggestions, setSuggestions] = useState<
    { id: string; slug?: string; title?: string }[]
  >([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/search?suggest=1&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions ?? []))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function runSearch(nextQ = q, nextMode = mode) {
    setError(null);
    const url = new URLSearchParams();
    if (nextQ) url.set("q", nextQ);
    url.set("mode", nextMode);
    router.replace(`/search?${url.toString()}`);
    startTransition(async () => {
      try {
        if (nextMode === "agent") {
          const res = await fetch("/api/search/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: nextQ }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Agent search failed");
          setHits(data.hits ?? []);
          setFacets(data.facetDistribution ?? {});
          setEngine(data.engine ?? "meili");
          return;
        }
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(nextQ)}&mode=${encodeURIComponent(nextMode)}&limit=36`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setHits(data.hits ?? []);
        setFacets(data.facetDistribution ?? {});
        setEngine(data.engine ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
      }
    });
  }

  useEffect(() => {
    if (initialQ || params.get("q")) {
      runSearch(initialQ || params.get("q") || "", initialMode || params.get("mode") || "hybrid");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / URL seed only
  }, []);

  async function onImage(file: File | null) {
    if (!file) return;
    setError(null);
    setMode("image");
    startTransition(async () => {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        const [header, data] = dataUrl.split(",");
        const mime = header.match(/data:(.*);base64/)?.[1] || file.type;
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "image",
            media: { mime, data },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Image search failed");
        setHits(json.hits ?? []);
        setFacets(json.facetDistribution ?? {});
        setEngine(json.engine ?? "");
        router.replace("/search?mode=image");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Image search failed");
      }
    });
  }

  const byIndex = {
    stickers: hits.filter((h) => h.index === "stickers"),
    collections: hits.filter((h) => h.index === "collections"),
    prints: hits.filter((h) => h.index === "prints"),
    blobbers: hits.filter((h) => h.index === "blobbers"),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent-pink">
        search
      </p>
      <h1 className="zune-header mt-1 text-4xl font-light lowercase tracking-tight text-primary sm:text-5xl">
        find anything
      </h1>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <div className="group relative flex items-center rounded-full border border-divider bg-surface p-2 shadow-xl shadow-black/5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-inactive">
            <Search className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Stickers, collections, prints, blobbers…"
            className="min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-inactive"
            autoComplete="off"
          />
          <BusyButton
            type="submit"
            busy={pending}
            className="rounded-full bg-accent-gradient px-6 py-3 text-sm font-semibold text-white"
          >
            Search
          </BusyButton>
        </div>
      </form>

      <MeiliTypeahead
        query={q}
        onPick={(title) => {
          setQ(title);
          runSearch(title, mode);
        }}
      />
      {!process.env.NEXT_PUBLIC_MEILI_HOST && suggestions.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="rounded-full border border-divider bg-surface px-3 py-1.5 text-xs text-secondary hover:border-accent-pink/40 hover:text-accent-pink"
                onClick={() => {
                  setQ(s.title || "");
                  runSearch(s.title || "", mode);
                }}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              if (m.id !== "image") runSearch(q, m.id);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
              mode === m.id
                ? "bg-accent-gradient text-white"
                : "border border-divider text-inactive"
            }`}
          >
            {m.label}
          </button>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-full border border-divider px-3 py-1.5 text-xs text-secondary hover:border-accent-pink/40">
          <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          Upload image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onImage(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {engine ? (
        <p className="mt-3 text-xs text-inactive">
          Engine: {engine}
          {pending ? " · searching…" : ""}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      {Object.keys(facets).length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          {Object.entries(facets).map(([facet, values]) => (
            <div key={facet}>
              <p className="mb-1 font-semibold uppercase tracking-wide text-inactive">
                {facet}
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(values)
                  .slice(0, 8)
                  .map(([v, n]) => (
                    <span
                      key={v}
                      className="rounded-full border border-divider px-2 py-0.5 text-secondary"
                    >
                      {v} ({n})
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {(
        [
          ["stickers", byIndex.stickers],
          ["collections", byIndex.collections],
          ["prints", byIndex.prints],
          ["blobbers", byIndex.blobbers],
        ] as const
      ).map(([section, list]) =>
        list.length ? (
          <section key={section} className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-inactive">
              {section}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((hit) => (
                <li key={`${hit.index}-${hit.id}`}>
                  <Link
                    href={hrefFor(hit)}
                    className="flex gap-3 rounded-[28px] border border-divider bg-surface p-3 transition hover:border-accent-pink/40"
                  >
                    {hit.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hit.previewUrl}
                        alt=""
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gradient/20 text-xs text-accent-pink">
                        {section.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-primary">
                        {labelFor(hit)}
                      </p>
                      <p className="text-xs text-inactive">{hit.kind || section}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {!pending && !hits.length && (q || mode === "image") ? (
        <p className="mt-12 text-center text-secondary">No results.</p>
      ) : null}
    </div>
  );
}
