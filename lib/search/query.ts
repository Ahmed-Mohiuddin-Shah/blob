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

export type SearchMode = "keywords" | "hybrid" | "semantic" | "image";

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
  if (mode === "image" && opts.media && q) {
    const fetchLimit = Math.min(96, Math.max(limit * 2, limit + 12));
    const [byImage, byText] = await Promise.all([
      meiliFederatedSearch({
        q: "",
        mode: "image",
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
      engine: byImage.engine === "meili" || byText.engine === "meili" ? "meili" : "prisma",
      hits: mergeRrfHits([byImage.hits, byText.hits], limit),
      facetDistribution:
        byImage.facetDistribution ?? byText.facetDistribution,
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
            mode === "image" ? MEILI_EMBEDDER.image : MEILI_EMBEDDER.text,
          semanticRatio: mode === "semantic" || mode === "image" ? 1 : 0.5,
        };

  try {
    // Image search must omit `q` — empty q still matches the text searchFragment
    // and Meili errors with "Query matches multiple search fragments".
    const stickerParams: Record<string, unknown> = {
      limit,
      facets: ["categorySlug", "tags", "mediaKind"],
      ...(opts.filter ? { filter: opts.filter } : {}),
      ...(hybrid ? { hybrid } : {}),
      ...(mode === "image" && opts.media
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
          limit: Math.min(12, limit),
          ...(mode !== "keywords" && mode !== "image"
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
          limit: Math.min(12, limit),
          ...(mode !== "keywords" && mode !== "image"
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
          limit: Math.min(8, limit),
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

    return { engine: "meili", hits, facetDistribution };
  } catch (err) {
    console.error("Meili search failed, Prisma fallback:", err);
    logMeiliError("federated search", err);
    return { engine: "prisma", hits: await prismaFallback(q, limit) };
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
