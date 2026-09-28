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
import { visionImageBase64 } from "@/lib/search/vision-image";
import {
  describePromptFromResolved,
  isSparseEnrich,
  parseVisionEnrichResult,
  type EnrichResult,
} from "@/lib/search/vision-parse";

/** Run metadata enrich against a draft prompt pack + image bytes (no DB write). */
export async function testMetaPrompts(
  prompts: ResolvedMetaPrompts,
  imageBytes: Buffer,
): Promise<{
  prose: string;
  result: EnrichResult | null;
  raw: string | null;
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
  const visionModel = process.env.OLLAMA_VISION_MODEL?.trim() || "moondream";
  const agentModel = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const b64 = await visionImageBase64(imageBytes);
  const describe = describePromptFromResolved(prompts, visionModel);

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
      prompt: visionJsonPromptFromResolved(prompts),
      images: [b64],
      options: jsonOpts,
    });
    try {
      result = parseVisionEnrichResult(raw);
    } catch {
      result = null;
    }
  }

  return { prose, result, raw };
}

/** Run search agent against a draft prompt pack + query (no DB write). */
export async function testSearchPrompts(
  prompts: ResolvedSearchPrompts,
  query: string,
): Promise<{
  plan: { q: string; mode: string; filter: string };
  hits: Array<{ id?: string; title?: string; slug?: string }>;
  raw: string;
  error?: string;
}> {
  if (!isOllamaConfigured()) {
    return {
      plan: { q: query, mode: "hybrid", filter: "" },
      hits: [],
      raw: "",
      error: "OLLAMA_BASE_URL is not set",
    };
  }
  const model = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const raw = await ollamaChat({
    model,
    prompt: searchAgentPromptFromResolved(prompts, query),
  });

  let plan = { q: query, mode: "hybrid", filter: "" };
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(
      start >= 0 && end > start ? raw.slice(start, end + 1) : raw,
    ) as { q?: string; mode?: string; filter?: string };
    plan = {
      q: parsed.q?.trim() || query,
      mode: ["hybrid", "semantic", "keywords"].includes(parsed.mode ?? "")
        ? (parsed.mode as string)
        : "hybrid",
      filter: parsed.filter?.trim() || "",
    };
  } catch {
    /* defaults */
  }

  const result = await meiliFederatedSearch({
    q: plan.q,
    mode: plan.mode as "hybrid" | "semantic" | "keywords",
    filter: plan.filter || undefined,
    limit: 8,
  });

  const hits = result.hits.slice(0, 8).map((h) => ({
    id: String(h.id),
    title: h.title,
    slug: h.slug,
  }));

  return { plan, hits, raw };
}
