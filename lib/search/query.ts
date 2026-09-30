import { blobberMediaUrl } from "@/lib/blobber-media-url";
import { ensureMeiliIndexes } from "@/lib/meili/bootstrap";
import { getMeili, isMeiliConfigured } from "@/lib/meili/client";
import { MEILI_EMBEDDER, MEILI_INDEX } from "@/lib/meili/indexes";
import { MODERATION_STATUS } from "@/lib/moderation";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { logMeiliError } from "@/lib/processing-log";
import {
  PROCESSING_STATUS,
  VISIBILITY,
} from "@/lib/stickers";

export type SearchMode = "keywords" | "hybrid" | "semantic" | "visual";

/** Legacy API alias `image` → `visual`. */
export function normalizeSearchMode(mode: string | undefined | null): SearchMode {
  if (mode === "image" || mode === "visual") return "visual";
  if (mode === "keywords" || mode === "semantic" || mode === "hybrid") {
    return mode;
  }
  return "hybrid";
}

export type FederatedHit = {
  index: string;
  id: string;
  slug?: string;
  title?: string;
  name?: string;
  displayName?: string;
  kind?: string;
  [key: string]: unknown;
};

/** Fill previewUrl when Meili docs predate the field (no reindex required). */
async function hydratePreviewUrls(hits: FederatedHit[]): Promise<FederatedHit[]> {
  const needColl = new Set<string>();
  const needBlob = new Set<string>();
  for (const h of hits) {
    if (h.previewUrl) continue;
    if (h.index === MEILI_INDEX.prints) {
      if (h.id.startsWith("sheet-")) {
        h.previewUrl = `/api/sheets/${h.id.slice(6)}/media/png`;
      } else if (h.id.startsWith("pack-")) {
        h.previewUrl = `/api/packs/${h.id.slice(5)}/media/png`;
      }
    } else if (h.index === MEILI_INDEX.stickers) {
      h.previewUrl = `/api/stickers/${h.id}/media/thumbnail`;
    } else if (h.index === MEILI_INDEX.collections) {
      needColl.add(h.id);
    } else if (h.index === MEILI_INDEX.blobbers) {
      needBlob.add(h.id);
    }
  }

  if (needColl.size) {
    const ids = [...needColl].flatMap((id) => {
      try {
        return [BigInt(id)];
      } catch {
        return [];
      }
    });
    if (ids.length) {
      const items = await prisma.collectionItem.findMany({
        where: { collectionId: { in: ids }, subjectType: "sticker" },
        orderBy: { sortOrder: "asc" },
        select: { collectionId: true, subjectId: true },
      });
      const cover = new Map<string, string>();
      for (const it of items) {
        const key = it.collectionId.toString();
        if (!cover.has(key)) cover.set(key, it.subjectId.toString());
      }
      for (const h of hits) {
        if (h.index !== MEILI_INDEX.collections || h.previewUrl) continue;
        const stickerId = cover.get(h.id);
        if (stickerId) {
          h.previewUrl = `/api/stickers/${stickerId}/media/thumbnail`;
        }
      }
    }
  }

  if (needBlob.size) {
    const ids = [...needBlob].flatMap((id) => {
      try {
        return [BigInt(id)];
      } catch {
        return [];
      }
    });
    if (ids.length) {
      const rows = await prisma.blobber.findMany({
        where: { id: { in: ids } },
        select: { id: true, avatarGlassObjectId: true },
      });
      const avatars = new Map(
        rows.map((b) => [
          b.id.toString(),
          blobberMediaUrl(b.avatarGlassObjectId) ?? "",
        ]),
      );
      for (const h of hits) {
        if (h.index !== MEILI_INDEX.blobbers || h.previewUrl) continue;
        const url = avatars.get(h.id);
        if (url) h.previewUrl = url;
      }
    }
  }

  return hits;
}

/** Reciprocal rank fusion — Meili can't take image + q in one query. */
export function mergeRrfHits(
  lists: FederatedHit[][],
  limit: number,
  k = 60,
): FederatedHit[] {
  const scores = new Map<string, { hit: FederatedHit; score: number }>();
  for (const list of lists) {
    list.forEach((h, i) => {
      const key = `${h.index}:${h.id}`;
      const add = 1 / (k + i + 1);
      const prev = scores.get(key);
      if (prev) prev.score += add;
      else scores.set(key, { hit: h, score: add });
    });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.hit);
}

export async function meiliFederatedSearch(opts: {
  q: string;
  mode?: SearchMode;
  limit?: number;
  filter?: string;
  media?: { mime: string; data: string };
}): Promise<{
  engine: "meili" | "prisma";
  hits: FederatedHit[];
  facetDistribution?: Record<string, Record<string, number>>;
}> {
  const limit = opts.limit ?? 24;
  const mode = opts.mode ?? "hybrid";
  const q = opts.q.trim();

  // Meili multimodal: q + media hit different searchFragments → error. Run both, RRF.
  if (mode === "visual" && opts.media && q) {
    const fetchLimit = Math.min(96, Math.max(limit * 2, limit + 12));
    const [byVisual, byText] = await Promise.all([
      meiliFederatedSearch({
        q: "",
        mode: "visual",
        limit: fetchLimit,
        filter: opts.filter,
        media: opts.media,
      }),
      meiliFederatedSearch({
        q,
        mode: "hybrid",
        limit: fetchLimit,
        filter: opts.filter,
      }),
    ]);
    return {
      engine:
        byVisual.engine === "meili" || byText.engine === "meili"
          ? "meili"
          : "prisma",
      hits: await hydratePreviewUrls(
        mergeRrfHits([byVisual.hits, byText.hits], limit),
      ),
      facetDistribution:
        byVisual.facetDistribution ?? byText.facetDistribution,
    };
  }

  if (!isMeiliConfigured() || !(await ensureMeiliIndexes())) {
    return { engine: "prisma", hits: await prismaFallback(q, limit) };
  }

  const meili = getMeili()!;
  const hybrid =
    mode === "keywords"
      ? undefined
      : {
          embedder:
            mode === "visual" ? MEILI_EMBEDDER.image : MEILI_EMBEDDER.text,
          semanticRatio: mode === "semantic" || mode === "visual" ? 1 : 0.5,
        };

  try {
    // Visual search must omit `q` — empty q still matches the text searchFragment
    // and Meili errors with "Query matches multiple search fragments".
    // Cap stickers at 5 for federated /search UI rows (callers can still pass lower).
    const stickerLimit = Math.min(5, limit);
    const stickerParams: Record<string, unknown> = {
      limit: stickerLimit,
      facets: ["categorySlug", "tags", "mediaKind"],
      ...(opts.filter ? { filter: opts.filter } : {}),
      ...(hybrid ? { hybrid } : {}),
      ...(mode === "visual" && opts.media
        ? { media: { image: opts.media } }
        : { q }),
    };

    const multi = await meili.multiSearch({
      queries: [
        {
          indexUid: MEILI_INDEX.stickers,
          ...stickerParams,
        },
        {
          indexUid: MEILI_INDEX.collections,
          q,
          limit: Math.min(5, limit),
          ...(mode !== "keywords" && mode !== "visual"
            ? {
                hybrid: {
                  embedder: MEILI_EMBEDDER.text,
                  semanticRatio: mode === "semantic" ? 1 : 0.5,
                },
              }
            : {}),
        },
        {
          indexUid: MEILI_INDEX.prints,
          q,
          limit: Math.min(5, limit),
          ...(mode !== "keywords" && mode !== "visual"
            ? {
                hybrid: {
                  embedder: MEILI_EMBEDDER.text,
                  semanticRatio: mode === "semantic" ? 1 : 0.5,
                },
              }
            : {}),
        },
        {
          indexUid: MEILI_INDEX.blobbers,
          q,
          limit: Math.min(5, limit),
        },
      ],
    });

    const hits: FederatedHit[] = [];
    let facetDistribution: Record<string, Record<string, number>> | undefined;
    for (const r of multi.results) {
      if (r.indexUid === MEILI_INDEX.stickers && r.facetDistribution) {
        facetDistribution = r.facetDistribution as Record<
          string,
          Record<string, number>
        >;
      }
      for (const h of r.hits) {
        hits.push({
          index: r.indexUid,
          ...(h as Record<string, unknown>),
          id: String((h as { id: string }).id),
        } as FederatedHit);
      }
    }

    // Fire-and-forget impression tally for sticker hits
    const stickerIds = hits
      .filter((h) => h.index === MEILI_INDEX.stickers)
      .map((h) => {
        try {
          return BigInt(h.id);
        } catch {
          return null;
        }
      })
      .filter((x): x is bigint => x != null);
    if (stickerIds.length) {
      void prisma.sticker
        .updateMany({
          where: { id: { in: stickerIds } },
          data: { searchAppearancesCount: { increment: 1 } },
        })
        .catch(() => {});
    }

    return {
      engine: "meili",
      hits: await hydratePreviewUrls(hits),
      facetDistribution,
    };
  } catch (err) {
    console.error("Meili search failed, Prisma fallback:", err);
    logMeiliError("federated search", err);
    return {
      engine: "prisma",
      hits: await hydratePreviewUrls(await prismaFallback(q, limit)),
    };
  }
}

export async function meiliScopedSearch(opts: {
  index: "stickers" | "collections" | "prints" | "blobbers";
  q: string;
  mode?: SearchMode;
  limit?: number;
  filter?: string;
  media?: { mime: string; data: string };
}) {
  const fed = await meiliFederatedSearch({
    q: opts.q,
    mode: opts.mode,
    limit: opts.limit,
    filter: opts.filter,
    media: opts.media,
  });
  return {
    ...fed,
    hits: fed.hits.filter((h) => h.index === opts.index),
  };
}

async function prismaFallback(q: string, limit: number): Promise<FederatedHit[]> {
  if (!q) return [];
  const stickers = await prisma.sticker.findMany({
    where: {
      visibility: VISIBILITY.public,
      moderationStatus: MODERATION_STATUS.approved,
      processingStatus: PROCESSING_STATUS.ready,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { keywords: { contains: q, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: [{ popularityScore: "desc" }, { publishedAt: "desc" }],
    select: { id: true, slug: true, title: true },
  });
  const collections = await prisma.collection.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 8,
    select: { id: true, slug: true, name: true },
  });
  const sheets = await prisma.stickerSheet.findMany({
    where: {
      status: PRINT_STATUS.ready,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 6,
    select: { id: true, slug: true, name: true },
  });
  return [
    ...stickers.map((s) => ({
      index: MEILI_INDEX.stickers,
      id: s.id.toString(),
      slug: s.slug,
      title: s.title,
    })),
    ...collections.map((c) => ({
      index: MEILI_INDEX.collections,
      id: c.id.toString(),
      slug: c.slug,
      name: c.name,
    })),
    ...sheets.map((s) => ({
      index: MEILI_INDEX.prints,
      id: `sheet-${s.id}`,
      slug: s.slug,
      name: s.name,
      kind: "sheet",
    })),
  ];
}

export async function relatedStickers(
  stickerId: bigint,
  limit = 5,
): Promise<FederatedHit[]> {
  const self = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: { title: true, aiCaption: true, categoryId: true },
  });
  if (!self) return [];

  if (isMeiliConfigured() && (await ensureMeiliIndexes())) {
    try {
      const meili = getMeili()!;
      const q = [self.title, self.aiCaption].filter(Boolean).join(" ");
      const res = await meili.index(MEILI_INDEX.stickers).search(q, {
        limit: limit + 1,
        filter: `id != "${stickerId.toString()}"`,
        hybrid: {
          embedder: MEILI_EMBEDDER.text,
          semanticRatio: 0.85,
        },
      });
      return res.hits.map((h: Record<string, unknown>) => ({
        index: MEILI_INDEX.stickers,
        ...h,
        id: String(h.id),
      })) as FederatedHit[];
    } catch {
      /* fall through */
    }
  }

  const rows = await prisma.sticker.findMany({
    where: {
      id: { not: stickerId },
      visibility: VISIBILITY.public,
      moderationStatus: MODERATION_STATUS.approved,
      processingStatus: PROCESSING_STATUS.ready,
      ...(self.categoryId ? { categoryId: self.categoryId } : {}),
    },
    take: limit,
    orderBy: { popularityScore: "desc" },
    select: { id: true, slug: true, title: true },
  });
  return rows.map((s) => ({
    index: MEILI_INDEX.stickers,
    id: s.id.toString(),
    slug: s.slug,
    title: s.title,
  }));
}
