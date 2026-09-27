"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MeiliTypeahead } from "@/components/meili-typeahead";
import { SearchBar } from "@/components/search-bar";
import {
  fileToHandoff,
  takeImageHandoff,
  type ImageHandoff,
} from "@/lib/search/image-handoff";

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

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.ok ? "Empty response" : `Search failed (${res.status})`,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Search failed (${res.status})`);
  }
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
        .then((r) => parseJsonResponse(r))
        .then((d) =>
          setSuggestions(
            (d.suggestions as { id: string; slug?: string; title?: string }[]) ??
              [],
          ),
        )
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function applyResult(data: Record<string, unknown>, engineFallback = "") {
    setHits((data.hits as Hit[]) ?? []);
    setFacets(
      (data.facetDistribution as Record<string, Record<string, number>>) ?? {},
    );
    setEngine(String(data.engine ?? engineFallback));
  }

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
          const data = await parseJsonResponse(res);
          if (!res.ok) throw new Error(String(data.error || "Agent search failed"));
          applyResult(data, "meili");
          return;
        }
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(nextQ)}&mode=${encodeURIComponent(nextMode)}&limit=36`,
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(String(data.error || "Search failed"));
        applyResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
      }
    });
  }

  function runImageSearch(media: ImageHandoff) {
    setError(null);
    setMode("image");
    startTransition(async () => {
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "image",
            media: { mime: media.mime, data: media.data },
          }),
        });
        const json = await parseJsonResponse(res);
        if (!res.ok) throw new Error(String(json.error || "Image search failed"));
        applyResult(json);
        router.replace("/search?mode=image");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Image search failed");
      }
    });
  }

  useEffect(() => {
    const handoff = takeImageHandoff();
    if (handoff) {
      runImageSearch(handoff);
      return;
    }
    if (initialQ || params.get("q")) {
      runSearch(
        initialQ || params.get("q") || "",
        initialMode || params.get("mode") || "hybrid",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / URL seed only
  }, []);

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

      <SearchBar
        variant="universal"
        className="mt-8"
        value={q}
        onChange={setQ}
        busy={pending}
        showCamera
        showAgent
        placeholder="Stickers, collections, prints, blobbers…"
        onSubmit={(next) => runSearch(next, mode === "image" ? "hybrid" : mode)}
        onImageSearch={(file) => {
          void fileToHandoff(file).then(runImageSearch);
        }}
        onAgentSearch={(next) => {
          setMode("agent");
          runSearch(next, "agent");
        }}
      />

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
