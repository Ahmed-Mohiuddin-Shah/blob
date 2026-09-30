import { logSearchError } from "@/lib/processing-log";
import {
  meiliFederatedSearch,
  type FederatedHit,
} from "@/lib/search/query";
import {
  mediaKindLabel,
  prepareSearchMedia,
  type SearchMediaIn,
} from "@/lib/search/prepare-media";

export type VisualSearchResult = {
  engine: "meili" | "prisma";
  hits: FederatedHit[];
  facetDistribution?: Record<string, Record<string, number>>;
  thoughtSteps: string[];
  usedVisual: true;
  processedImage?: string;
};

export async function runVisualSearch(opts: {
  q?: string;
  media?: SearchMediaIn | null;
  limit?: number;
  filter?: string;
  onStep?: (label: string) => void;
}): Promise<VisualSearchResult> {
  const step = (label: string) => {
    opts.onStep?.(label);
  };
  const q = opts.q?.trim() ?? "";
  const rawMime = opts.media?.mime;
  const kind = mediaKindLabel(rawMime);

  try {
    if (!opts.media?.data) {
      throw new Error("visual search needs media");
    }

    if (kind === "gif" || kind === "video") {
      step(
        kind === "video"
          ? "unrolling video frames…"
          : "unrolling gif frames…",
      );
      step("building storyboard…");
    } else {
      step("squishing your pic…");
    }

    const prepared = await prepareSearchMedia(opts.media);
    if (!prepared.media) throw new Error("media prepare failed");

    step("sniffing lookalikes…");
    if (q) step("mixing in your words…");

    const result = await meiliFederatedSearch({
      q,
      mode: "visual",
      media: prepared.media,
      limit: opts.limit ?? 5,
      filter: opts.filter,
    });

    return {
      engine: result.engine,
      hits: result.hits,
      facetDistribution: result.facetDistribution,
      thoughtSteps: [],
      usedVisual: true,
      processedImage: prepared.processedFromMotion
        ? prepared.media.data
        : undefined,
    };
  } catch (err) {
    logSearchError(`visual ${kind}${q ? ` · ${q.slice(0, 80)}` : ""}`, err);
    throw err;
  }
}
