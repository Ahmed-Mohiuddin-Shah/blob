import {
  isOllamaConfigured,
  ollamaChat,
  ollamaChatOptions,
} from "@/lib/ollama/client";
import {
  searchAgentPromptFromResolved,
  structurePromptFromResolved,
  visionJsonPromptFromResolved,
  type ResolvedMetaPrompts,
  type ResolvedSearchPrompts,
} from "@/lib/search/prompt-defaults";
import { meiliFederatedSearch } from "@/lib/search/query";
import { prepareSearchMedia } from "@/lib/search/prepare-media";
import { runVisualSearch } from "@/lib/search/run-visual";
import { visionImageBase64 } from "@/lib/search/vision-image";
import {
  describePromptFromResolved,
  isSparseEnrich,
  parseVisionEnrichResult,
  type EnrichResult,
} from "@/lib/search/vision-parse";

/** Run metadata enrich against a draft prompt pack + media bytes (no DB write). */
export async function testMetaPrompts(
  prompts: ResolvedMetaPrompts,
  imageBytes: Buffer,
  mime = "image/jpeg",
): Promise<{
  prose: string;
  result: EnrichResult | null;
  raw: string | null;
  processedImage?: string;
  error?: string;
}> {
  if (!isOllamaConfigured()) {
    return {
      prose: "",
      result: null,
      raw: null,
      error: "OLLAMA_BASE_URL is not set",
    };
  }
  const visionModel = process.env.OLLAMA_VISION_MODEL?.trim() || "qwen2.5vl:3b";
  const agentModel = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";

  const prepared = await prepareSearchMedia({
    mime,
    data: imageBytes.toString("base64"),
  });
  if (!prepared.media) {
    return {
      prose: "",
      result: null,
      raw: null,
      error: "media prepare failed",
    };
  }
  const storyboard = prepared.processedFromMotion;
  const b64 = storyboard
    ? prepared.media.data
    : await visionImageBase64(Buffer.from(prepared.media.data, "base64"));
  const describe = describePromptFromResolved(prompts, visionModel, {
    storyboard,
  });

  let prose = (
    await ollamaChat({
      model: visionModel,
      prompt: describe,
      images: [b64],
      options: ollamaChatOptions("describe"),
    })
  ).trim();
  if (!prose) {
    prose = (
      await ollamaChat({
        model: visionModel,
        prompt: describe,
        images: [b64],
        options: ollamaChatOptions("describe"),
      })
    ).trim();
  }
  if (!prose) {
    return {
      prose: "",
      result: null,
      raw: null,
      processedImage: storyboard ? b64 : undefined,
      error: `Vision description empty (${visionModel})`,
    };
  }

  const structureOnce = structurePromptFromResolved(prompts, prose);
  const jsonOpts = ollamaChatOptions("json");
  let raw = await ollamaChat({
    model: agentModel,
    prompt: structureOnce,
    options: jsonOpts,
  });
  let result: EnrichResult | null = null;
  try {
    result = parseVisionEnrichResult(raw);
  } catch {
    result = null;
  }

  if (!result || isSparseEnrich(result)) {
    raw = await ollamaChat({
      model: agentModel,
      prompt: `${structureOnce}\n\nYour previous reply was missing scenario or tags. Fill ALL three fields.`,
      options: jsonOpts,
    });
    try {
      result = parseVisionEnrichResult(raw);
    } catch {
      result = null;
    }
  }

  if (!result || isSparseEnrich(result)) {
    raw = await ollamaChat({
      model: visionModel,
      prompt: visionJsonPromptFromResolved(prompts, { storyboard }),
      images: [b64],
      options: jsonOpts,
    });
    try {
      result = parseVisionEnrichResult(raw);
    } catch {
      result = null;
    }
  }

  return {
    prose,
    result,
    raw,
    processedImage: storyboard ? b64 : undefined,
  };
}

/** Run search agent / visual against a draft prompt pack (no DB write). */
export async function testSearchPrompts(
  prompts: ResolvedSearchPrompts,
  query: string,
  media?: { mime: string; data: string } | null,
): Promise<{
  plan: { q: string; mode: string; filter: string };
  hits: Array<{ id?: string; title?: string; slug?: string }>;
  raw: string;
  processedImage?: string;
  usedVisual?: boolean;
  agentSkipped?: boolean;
  error?: string;
}> {
  const q = query.trim();
  const hasMedia = Boolean(media?.data && media.mime);

  // Media-only → visual search (mirrors prod).
  if (hasMedia && !q) {
    try {
      const vis = await runVisualSearch({
        q: "",
        media: media!,
      });
      return {
        plan: { q: "", mode: "visual", filter: "" },
        hits: vis.hits.slice(0, 8).map((h) => ({
          id: String(h.id),
          title: (h.title ?? h.name ?? h.displayName) as string | undefined,
          slug: h.slug,
        })),
        raw: "",
        processedImage: vis.processedImage,
        usedVisual: true,
        agentSkipped: true,
      };
    } catch (err) {
      return {
        plan: { q: "", mode: "visual", filter: "" },
        hits: [],
        raw: "",
        error: err instanceof Error ? err.message : "Visual search failed",
      };
    }
  }

  let processedImage: string | undefined;
  let preparedMedia: { mime: string; data: string } | null = null;
  if (hasMedia) {
    try {
      const prepared = await prepareSearchMedia(media!);
      preparedMedia = prepared.media;
      if (prepared.processedFromMotion && prepared.media) {
        processedImage = prepared.media.data;
      }
    } catch (err) {
      console.warn("test search media prepare:", err);
    }
  }

  let plan = { q: q || "sticker", mode: "hybrid", filter: "" };
  let raw = "";
  if (isOllamaConfigured() && q) {
    try {
      const model = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
      raw = await ollamaChat({
        model,
        prompt: searchAgentPromptFromResolved(prompts, q, {
          hasVisual: hasMedia,
        }),
      });
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const parsed = JSON.parse(
        start >= 0 && end > start ? raw.slice(start, end + 1) : raw,
      ) as { q?: string; mode?: string; filter?: string };
      plan = {
        q: parsed.q?.trim() || q || "sticker",
        mode: ["hybrid", "semantic", "keywords"].includes(parsed.mode ?? "")
          ? (parsed.mode as string)
          : "hybrid",
        filter: parsed.filter?.trim() || "",
      };
    } catch (err) {
      console.warn("test search planner failed, using query as-is:", err);
      raw = err instanceof Error ? err.message : String(err);
    }
  }

  let result = await meiliFederatedSearch({
    q: plan.q,
    mode: plan.mode as "hybrid" | "semantic" | "keywords",
    filter: plan.filter || undefined,
    limit: 8,
  });

  if (preparedMedia) {
    try {
      const byVisual = await meiliFederatedSearch({
        q: plan.q,
        mode: "visual",
        media: preparedMedia,
        limit: 8,
      });
      const { mergeRrfHits } = await import("@/lib/search/query");
      result = {
        engine:
          result.engine === "meili" || byVisual.engine === "meili"
            ? "meili"
            : "prisma",
        hits: mergeRrfHits([result.hits, byVisual.hits], 8),
        facetDistribution:
          result.facetDistribution ?? byVisual.facetDistribution,
      };
    } catch (err) {
      console.warn("test search visual fuse:", err);
    }
  }

  const hits = result.hits.slice(0, 8).map((h) => ({
    id: String(h.id),
    title:
      (h.title as string | undefined) ||
      (h.name as string | undefined) ||
      (h.displayName as string | undefined),
    slug: h.slug as string | undefined,
  }));

  return {
    plan,
    hits,
    raw,
    processedImage,
    usedVisual: hasMedia,
  };
}
