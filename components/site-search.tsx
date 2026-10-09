"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { MeiliTypeahead } from "@/components/meili-typeahead";
import { SearchBar } from "@/components/search-bar";
import {
  ThoughtLine,
  type ThoughtStep,
} from "@/components/thought-line";
import {
  allowedSearchModes,
  defaultSearchMode,
  normalizeSearchUiMode,
  type CapabilityUser,
  type SearchUiMode,
} from "@/lib/capabilities";
import {
  fileToSearchMedia,
  takeImageHandoff,
  type ImageHandoff,
} from "@/lib/search/image-handoff";
import { runSearchOverWs } from "@/lib/search/search-ws-client";
import { signInUrl } from "@/lib/auth-urls";

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
  { id: "visual" as const, label: "Visual" },
  { id: "agent" as const, label: "Agent" },
];

function hrefFor(hit: Hit): string {
  if (hit.index === "stickers" && hit.slug) return `/stickers/${hit.slug}`;
  if (hit.index === "collections" && hit.slug) return `/collections/${hit.slug}`;
  if (hit.index === "prints" && hit.slug) {
    return hit.kind === "pack" ? `/packs/${hit.slug}` : `/sheets/${hit.slug}`;
  }
  if (hit.index === "blobbers") {
    return hit.slug ? `/blobbers/${hit.slug}` : `/blobbers/id/${hit.id}`;
  }
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

function previewUrlFor(media: ImageHandoff): string {
  if (media.mime.startsWith("video/")) {
    try {
      const bin = atob(media.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: media.mime }));
    } catch {
      /* fall through */
    }
  }
  return `data:${media.mime};base64,${media.data}`;
}

function seedSteps(mode: string): ThoughtStep[] {
  if (mode === "agent") {
    return [{ label: "waking the search gremlin…", done: false }];
  }
  if (mode === "visual" || mode === "visual+text") {
    return [{ label: "warming…", done: false }];
  }
  if (mode === "semantic") {
    return [
      { label: "turning words into vibes…", done: false },
      { label: "hunting by meaning…", done: false },
    ];
  }
  if (mode === "hybrid") {
    return [
      { label: "keywords + vibes mashup…", done: false },
      { label: "scouring the shelves…", done: false },
    ];
  }
  return [
    { label: "literal keyword dig…", done: false },
    { label: "scouring the shelves…", done: false },
  ];
}

function clampMode(
  requested: string | undefined,
  allowed: Set<SearchUiMode>,
  fallback: SearchUiMode,
): SearchUiMode {
  const norm = normalizeSearchUiMode(requested);
  if (norm && allowed.has(norm as SearchUiMode)) {
    return norm as SearchUiMode;
  }
  return fallback;
}

function pushLiveStep(
  setSteps: Dispatch<SetStateAction<ThoughtStep[]>>,
  label: string,
) {
  setSteps((prev) => {
    const donePrev = prev.map((s) => ({ ...s, done: true }));
    return [...donePrev, { label, done: false }];
  });
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
  const [imageMedia, setImageMedia] = useState<ImageHandoff | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ThoughtStep[]>([]);
  const [thoughtLabel, setThoughtLabel] = useState("Searching…");
  const [doneLabel, setDoneLabel] = useState("Thought for");
  const [thoughtFailed, setThoughtFailed] = useState(false);
  const [showThought, setShowThought] = useState(false);

  const canVisual = allowed.has("visual");
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
    setThoughtFailed(false);
    setThoughtLabel(
      nextMode === "agent"
        ? "agent is plotting…"
        : nextMode === "visual" || nextMode === "visual+text"
          ? "eyeing your upload…"
          : "searching…",
    );
    setDoneLabel("Thought for");
    setSteps(seedSteps(nextMode));
  }

  function finishThought(opts: {
    nextMode: string;
    engineName: string;
    plan?: AgentPlan | null;
    hitCount: number;
    fallback?: boolean;
  }) {
    const eng = opts.engineName || "search";
    const prismaFallback = eng === "prisma";
    const failed = Boolean(opts.fallback || prismaFallback);
    setThoughtFailed(failed);
    const provenance = [
      opts.nextMode,
      prismaFallback ? "filing-cabinet" : eng,
      `${opts.hitCount} find${opts.hitCount === 1 ? "" : "s"}`,
    ].join(" · ");
    setDoneLabel(
      failed
        ? `Wobbly but done · ${provenance}`
        : `Done · ${provenance}`,
    );
    setSteps((prev) => {
      const base = prev.map((s) => ({ ...s, done: true }));
      const extra: ThoughtStep[] = [];
      if (prismaFallback) {
        extra.push({
          label: "Meili napped — dug through the filing cabinet instead",
          done: true,
          failed: true,
        });
      }
      if (opts.plan) {
        extra.push(
          { label: `hunting “${opts.plan.q}”`, done: true },
          { label: `mode: ${opts.plan.mode}`, done: true },
        );
        if (opts.plan.filter) {
          extra.push({ label: `filter: ${opts.plan.filter}`, done: true });
        }
      }
      extra.push({ label: provenance, done: true, failed });
      return [...base, ...extra];
    });
  }

  function applyResult(data: {
    hits?: unknown;
    facetDistribution?: unknown;
    engine?: unknown;
  }, engineFallback = "") {
    setHits((data.hits as Hit[]) ?? []);
    setFacets(
      (data.facetDistribution as Record<string, Record<string, number>>) ?? {},
    );
    setEngine(String(data.engine ?? engineFallback));
  }

  async function withColdRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const cold =
        /502|503|bad.?gateway|cold|ECONNRESET|connection closed|WebSocket/i.test(
          msg,
        );
      if (!cold) throw e;
      pushLiveStep(setSteps, "model was cold — trying once more…");
      return await fn();
    }
  }

  function runWsSearch(
    wsMode: "visual" | "agent",
    nextQ: string,
    media: ImageHandoff | null,
  ) {
    const url = new URLSearchParams();
    if (nextQ) url.set("q", nextQ);
    url.set("mode", wsMode === "agent" && media && !nextQ.trim() ? "visual" : wsMode);
    router.replace(`/search?${url.toString()}`);

    const thoughtMode =
      wsMode === "visual"
        ? nextQ.trim()
          ? "visual+text"
          : "visual"
        : "agent";
    beginThought(thoughtMode);

    startTransition(async () => {
      try {
        const data = await withColdRetry(() =>
          runSearchOverWs({
            mode: wsMode,
            q: nextQ,
            media,
            onStep: (label) => pushLiveStep(setSteps, label),
          }),
        );
        applyResult(data, "meili");
        if (data.processedImage) {
          // Storyboard JPEG — update mime so <video> isn't used for a still.
          setImageMedia((prev) =>
            prev
              ? { ...prev, mime: "image/jpeg", data: data.processedImage! }
              : prev,
          );
          setImagePreview(`data:image/jpeg;base64,${data.processedImage}`);
        }
        const resultMode =
          data.mode === "visual"
            ? nextQ.trim()
              ? "visual+text"
              : "visual"
            : "agent";
        if (data.mode === "visual") setMode("visual");
        finishThought({
          nextMode: resultMode,
          engineName: String(data.engine ?? "meili"),
          plan: (data.plan as AgentPlan | undefined) ?? null,
          hitCount: ((data.hits as Hit[]) ?? []).length,
          fallback: Boolean(data.planFallback),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
        setThoughtFailed(true);
        setDoneLabel("Oop — search tripped");
        setSteps((prev) => [
          ...prev.map((s) => ({ ...s, done: true })),
          {
            label: e instanceof Error ? e.message : "something went sideways",
            done: true,
            failed: true,
          },
        ]);
      }
    });
  }

  function runSearch(nextQ = q, nextMode: SearchUiMode = mode) {
    if (!allowed.has(nextMode)) {
      setError(`“${nextMode}” search needs a higher account tier`);
      return;
    }
    setError(null);

    if (nextMode === "agent") {
      if (imageMedia && !nextQ.trim()) {
        if (!canVisual) {
          setError("Visual search requires a member account");
          return;
        }
        setMode("visual");
        runWsSearch("visual", "", imageMedia);
        return;
      }
      runWsSearch("agent", nextQ, imageMedia);
      return;
    }

    if (nextMode === "visual") {
      if (!imageMedia) {
        setError("Attach an image, GIF, or video for visual search");
        return;
      }
      runWsSearch("visual", nextQ, imageMedia);
      return;
    }

    const url = new URLSearchParams();
    if (nextQ) url.set("q", nextQ);
    url.set("mode", nextMode);
    router.replace(`/search?${url.toString()}`);
    beginThought(nextMode);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(nextQ)}&mode=${encodeURIComponent(nextMode)}&limit=5`,
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(String(data.error || "Search failed"));
        applyResult(data);
        finishThought({
          nextMode,
          engineName: String(data.engine ?? ""),
          hitCount: ((data.hits as Hit[]) ?? []).length,
          fallback: String(data.engine ?? "") === "prisma",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setHits([]);
        setThoughtFailed(true);
        setDoneLabel("Oop — search tripped");
        setSteps((prev) => [
          ...prev.map((s) => ({ ...s, done: true })),
          {
            label: e instanceof Error ? e.message : "something went sideways",
            done: true,
            failed: true,
          },
        ]);
      }
    });
  }

  function runVisualSearch(media: ImageHandoff, textQ = q) {
    if (!canVisual) {
      setError("Visual search requires a member account");
      return;
    }
    setError(null);
    setMode("visual");
    setImageMedia(media);
    setImagePreview(previewUrlFor(media));
    runWsSearch("visual", textQ.trim(), media);
  }

  function clearImage() {
    setImagePreview(null);
    setImageMedia(null);
  }

  useEffect(() => {
    const handoff = takeImageHandoff();
    if (handoff) {
      if (!canVisual) {
        setError("Visual search requires a member account — sign in as a member");
        return;
      }
      const seedQ = initialQ || params.get("q") || q;
      runVisualSearch(handoff, seedQ);
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
    ? "Sign in for semantic search. Members unlock hybrid, visual, and agent."
    : lockedModes.length > 0
      ? "Ask an admin to promote you to member for hybrid, visual, and agent search."
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
        showCamera={canVisual}
        showAgent={canAgent}
        placeholder="Stickers, collections, prints, blobbers…"
        imagePreviewUrl={imagePreview}
        imagePreviewMime={imageMedia?.mime ?? null}
        onClearImagePreview={clearImage}
        onSubmit={(next) => {
          if (mode === "agent") {
            if (imageMedia && !next.trim()) {
              runVisualSearch(imageMedia, "");
              return;
            }
            runSearch(next, "agent");
            return;
          }
          if (imageMedia && canVisual) {
            runVisualSearch(imageMedia, next);
            return;
          }
          runSearch(
            next,
            mode === "visual"
              ? allowed.has("hybrid")
                ? "hybrid"
                : fallback
              : mode,
          );
        }}
        onImageSearch={(file) => {
          void fileToSearchMedia(file)
            .then((media) => {
              setImageMedia(media);
              // Video: object URL for <video> preview; still/gif: data URL or blob.
              setImagePreview(
                media.mime.startsWith("video/")
                  ? URL.createObjectURL(file)
                  : media.mime === "image/gif"
                    ? URL.createObjectURL(file)
                    : previewUrlFor(media),
              );
              if (mode === "agent") {
                if (!q.trim()) {
                  runVisualSearch(media, "");
                  return;
                }
                runSearch(q, "agent");
                return;
              }
              runVisualSearch(media, q);
            })
            .catch((e) =>
              setError(e instanceof Error ? e.message : "Upload failed"),
            );
        }}
        onAgentSearch={(next) => {
          setMode("agent");
          if (imageMedia && !next.trim()) {
            runVisualSearch(imageMedia, "");
            return;
          }
          runSearch(next, "agent");
        }}
      />

      {(showThought || pending) && steps.length > 0 ? (
        <div className="mt-4 rounded-[24px] border border-divider bg-surface/80 px-4 py-3">
          <ThoughtLine
            working={pending}
            failed={thoughtFailed}
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
          if (mode === "agent") {
            runSearch(title, "agent");
            return;
          }
          if (imageMedia && canVisual) {
            runVisualSearch(imageMedia, title);
            return;
          }
          runSearch(title, mode === "visual" ? fallback : mode);
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
                  if (imageMedia && canVisual) {
                    runVisualSearch(imageMedia, s.title || "");
                    return;
                  }
                  runSearch(s.title || "", mode === "visual" ? fallback : mode);
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
                if (m.id === "agent") {
                  if (imageMedia && !q.trim()) {
                    runVisualSearch(imageMedia, "");
                    return;
                  }
                  runSearch(q, "agent");
                  return;
                }
                if (m.id === "visual") {
                  if (imageMedia) runVisualSearch(imageMedia, q);
                  return;
                }
                if (imageMedia && canVisual) {
                  setMode("visual");
                  runVisualSearch(imageMedia, q);
                  return;
                }
                runSearch(q, m.id);
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
              onClick={() => {
                window.location.assign(signInUrl());
              }}
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
            <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {list.slice(0, 5).map((hit) => (
                <li
                  key={`${hit.index}-${hit.id}`}
                  className="w-[11.5rem] shrink-0 snap-start"
                >
                  <Link
                    href={hrefFor(hit)}
                    className="flex h-full flex-col gap-2 rounded-[28px] border border-divider bg-surface p-3 transition hover:border-accent-pink/40"
                  >
                    {hit.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hit.previewUrl}
                        alt=""
                        className="aspect-square w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-accent-gradient/20 text-sm text-accent-pink">
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

      {!pending && !hits.length && (q || mode === "visual") ? (
        <p className="mt-12 text-center text-secondary">No results.</p>
      ) : null}
    </div>
  );
}
