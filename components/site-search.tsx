"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { MeiliTypeahead } from "@/components/meili-typeahead";
import { SearchBar } from "@/components/search-bar";
import {
  ThoughtLine,
  type ThoughtStep,
} from "@/components/thought-line";
import {
  allowedSearchModes,
  defaultSearchMode,
  type CapabilityUser,
  type SearchUiMode,
} from "@/lib/capabilities";
import {
  fileToHandoff,
  takeImageHandoff,
  type ImageHandoff,
} from "@/lib/search/image-handoff";
import { signIn } from "@zitadel/next-auth/react";

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

type AgentPlan = { q: string; mode: string; filter: string };

type Props = {
  initialQ?: string;
  initialMode?: string;
  /** null = guest */
  capUser?: CapabilityUser | null;
};

const MODES = [
  { id: "hybrid" as const, label: "Hybrid" },
  { id: "keywords" as const, label: "Keywords" },
  { id: "semantic" as const, label: "Semantic" },
  { id: "image" as const, label: "Image" },
  { id: "agent" as const, label: "Agent" },
];

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

function seedSteps(mode: string): ThoughtStep[] {
  if (mode === "agent") {
    return [{ label: "Planning query with agent…", done: false }];
  }
  if (mode === "image") {
    return [
      { label: "Encoding image…", done: false },
      { label: "Image similarity search", done: false },
    ];
  }
  if (mode === "semantic") {
    return [
      { label: "Embedding query…", done: false },
      { label: "Semantic search", done: false },
    ];
  }
  if (mode === "hybrid") {
    return [
      { label: "Hybrid keyword + semantic…", done: false },
      { label: "Federated Meili search", done: false },
    ];
  }
  return [
    { label: "Keyword search", done: false },
    { label: "Federated Meili search", done: false },
  ];
}

function clampMode(
  requested: string | undefined,
  allowed: Set<SearchUiMode>,
  fallback: SearchUiMode,
): SearchUiMode {
  if (requested && allowed.has(requested as SearchUiMode)) {
    return requested as SearchUiMode;
  }
  return fallback;
}

export function SiteSearch({
  initialQ = "",
  initialMode,
  capUser = null,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const allowed = useMemo(() => allowedSearchModes(capUser), [capUser]);
  const fallback = defaultSearchMode(capUser);
  const [q, setQ] = useState(initialQ || params.get("q") || "");
  const [mode, setMode] = useState<SearchUiMode>(() =>
    clampMode(initialMode || params.get("mode") || undefined, allowed, fallback),
  );
  const [hits, setHits] = useState<Hit[]>([]);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [engine, setEngine] = useState<string>("");
  const [suggestions, setSuggestions] = useState<
    { id: string; slug?: string; title?: string }[]
  >([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ThoughtStep[]>([]);
  const [thoughtLabel, setThoughtLabel] = useState("Searching…");
  const [doneLabel, setDoneLabel] = useState("Thought for");
  const [showThought, setShowThought] = useState(false);

  const canImage = allowed.has("image");
  const canAgent = allowed.has("agent");
  const lockedModes = MODES.filter((m) => !allowed.has(m.id));

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

  function beginThought(nextMode: string) {
    setShowThought(true);
    setThoughtLabel(
      nextMode === "agent"
        ? "Agent thinking…"
        : nextMode === "image"
          ? "Searching by image…"
          : "Searching…",
    );
    setDoneLabel("Thought for");
    setSteps(seedSteps(nextMode));
  }

  function finishThought(opts: {
    nextMode: string;
    engineName: string;
    plan?: AgentPlan | null;
    hitCount: number;
  }) {
    const provenance = [
      opts.nextMode,
      opts.engineName || "search",
      `${opts.hitCount} hit${opts.hitCount === 1 ? "" : "s"}`,
    ].join(" · ");
    setDoneLabel(`Done · ${provenance}`);
    setSteps((prev) => {
      const base = prev.map((s) => ({ ...s, done: true }));
      if (opts.plan) {
        const planBits = [
          `Plan q: ${opts.plan.q}`,
          `Plan mode: ${opts.plan.mode}`,
          opts.plan.filter ? `Filter: ${opts.plan.filter}` : null,
        ].filter(Boolean) as string[];
        return [
          { label: "Planned Meili query", done: true },
          ...planBits.map((label) => ({ label, done: true })),
          { label: `Ran search · ${opts.engineName}`, done: true },
          { label: provenance, done: true },
        ];
      }
      return [...base, { label: provenance, done: true }];
    });
  }

  function applyResult(data: Record<string, unknown>, engineFallback = "") {
    setHits((data.hits as Hit[]) ?? []);
    setFacets(
      (data.facetDistribution as Record<string, Record<string, number>>) ?? {},
    );
    setEngine(String(data.engine ?? engineFallback));
  }

  function runSearch(nextQ = q, nextMode: SearchUiMode = mode) {
    if (!allowed.has(nextMode)) {
      setError(`“${nextMode}” search needs a higher account tier`);
      return;
    }
    setError(null);
    const url = new URLSearchParams();
    if (nextQ) url.set("q", nextQ);
    url.set("mode", nextMode);
    router.replace(`/search?${url.toString()}`);
    beginThought(nextMode);
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
          const plan = data.plan as AgentPlan | undefined;
          finishThought({
            nextMode,
            engineName: String(data.engine ?? "meili"),
            plan: plan ?? null,
            hitCount: ((data.hits as Hit[]) ?? []).length,
          });
          return;
        }
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(nextQ)}&mode=${encodeURIComponent(nextMode)}&limit=36`,
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(String(data.error || "Search failed"));
        applyResult(data);
        finishThought({
          nextMode,
          engineName: String(data.engine ?? ""),
          hitCount: ((data.hits as Hit[]) ?? []).length,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
        setDoneLabel("Search failed");
        setSteps((prev) => [
          ...prev.map((s) => ({ ...s, done: true })),
          {
            label: e instanceof Error ? e.message : "Search failed",
            done: true,
          },
        ]);
      }
    });
  }

  function runImageSearch(media: ImageHandoff) {
    if (!canImage) {
      setError("Image search requires a member account");
      return;
    }
    setError(null);
    setMode("image");
    setImagePreview(`data:${media.mime};base64,${media.data}`);
    beginThought("image");
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
        finishThought({
          nextMode: "image",
          engineName: String(json.engine ?? "meili"),
          hitCount: ((json.hits as Hit[]) ?? []).length,
        });
        router.replace("/search?mode=image");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Image search failed");
        setDoneLabel("Search failed");
      }
    });
  }

  useEffect(() => {
    const handoff = takeImageHandoff();
    if (handoff) {
      if (!canImage) {
        setError("Image search requires a member account — sign in as a member");
        return;
      }
      setImagePreview(`data:${handoff.mime};base64,${handoff.data}`);
      runImageSearch(handoff);
      return;
    }
    const seedQ = initialQ || params.get("q");
    if (seedQ) {
      const seedMode = clampMode(
        initialMode || params.get("mode") || undefined,
        allowed,
        fallback,
      );
      setMode(seedMode);
      runSearch(seedQ, seedMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / URL seed only
  }, []);

  const byIndex = {
    stickers: hits.filter((h) => h.index === "stickers"),
    collections: hits.filter((h) => h.index === "collections"),
    prints: hits.filter((h) => h.index === "prints"),
    blobbers: hits.filter((h) => h.index === "blobbers"),
  };

  const upsellText = !capUser
    ? "Sign in for semantic search. Members unlock hybrid, image, and agent."
    : lockedModes.length > 0
      ? "Ask an admin to promote you to member for hybrid, image, and agent search."
      : null;

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
        showCamera={canImage}
        showAgent={canAgent}
        placeholder="Stickers, collections, prints, blobbers…"
        imagePreviewUrl={imagePreview}
        onClearImagePreview={() => setImagePreview(null)}
        onSubmit={(next) =>
          runSearch(next, mode === "image" ? (allowed.has("hybrid") ? "hybrid" : fallback) : mode)
        }
        onImageSearch={(file) => {
          void fileToHandoff(file).then(runImageSearch);
        }}
        onAgentSearch={(next) => {
          setMode("agent");
          runSearch(next, "agent");
        }}
      />

      {(showThought || pending) && steps.length > 0 ? (
        <div className="mt-4 rounded-[24px] border border-divider bg-surface/80 px-4 py-3">
          <ThoughtLine
            working={pending}
            label={thoughtLabel}
            doneLabel={doneLabel}
            steps={steps}
          />
        </div>
      ) : null}

      <MeiliTypeahead
        query={q}
        onPick={(title) => {
          setQ(title);
          runSearch(title, mode === "image" ? fallback : mode);
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
                  runSearch(s.title || "", mode === "image" ? fallback : mode);
                }}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {MODES.map((m) => {
          const ok = allowed.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              disabled={!ok}
              title={ok ? undefined : "Requires a higher account tier"}
              onClick={() => {
                if (!ok) return;
                setMode(m.id);
                if (m.id !== "image") runSearch(q, m.id);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                mode === m.id && ok
                  ? "bg-accent-gradient text-white"
                  : ok
                    ? "border border-divider text-inactive"
                    : "cursor-not-allowed border border-divider text-inactive/40 line-through"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {upsellText ? (
        <p className="mt-3 text-xs text-secondary">
          {upsellText}{" "}
          {!capUser ? (
            <button
              type="button"
              className="font-semibold text-accent-pink hover:underline"
              onClick={() => void signIn("zitadel")}
            >
              Sign in
            </button>
          ) : null}
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
