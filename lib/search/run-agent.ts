import type { CapabilityUser } from "@/lib/capabilities";
import { isOllamaConfigured, ollamaChat } from "@/lib/ollama/client";
import {
  ollamaChatWithTools,
  parseToolArgs,
  type ChatMessage,
} from "@/lib/ollama/tools";
import { logSearchError } from "@/lib/processing-log";
import {
  runAgentSearchTool,
  SEARCH_AGENT_TOOLS,
  searchCapabilitiesPayload,
  type AgentTextMode,
} from "@/lib/search/agent-tools";
import { prepareSearchMedia, type SearchMediaIn } from "@/lib/search/prepare-media";
import {
  getResolvedSearchPrompts,
  searchAgentPromptFromResolved,
} from "@/lib/search/prompts";
import {
  meiliFederatedSearch,
  mergeRrfHits,
  type FederatedHit,
} from "@/lib/search/query";
import { parseSearchAgentPlan } from "@/lib/search/vision-parse";

const MAX_TOOL_DEPTH = 2;

export type AgentSearchResult = {
  plan: { q: string; mode: AgentTextMode; filter: string };
  engine: "meili" | "prisma";
  hits: FederatedHit[];
  facetDistribution?: Record<string, Record<string, number>>;
  thoughtSteps: string[];
  usedTools: boolean;
  planFallback: boolean;
  usedVisual: boolean;
  processedImage?: string;
};

export async function runAgentSearch(opts: {
  q?: string;
  media?: SearchMediaIn | null;
  user: CapabilityUser | null;
  onStep?: (label: string) => void;
}): Promise<AgentSearchResult> {
  const step = (label: string) => {
    opts.onStep?.(label);
  };

  const userQ = opts.q?.trim() ?? "";
  let media: SearchMediaIn | null = null;
  let processedImage: string | undefined;

  try {
  if (!isOllamaConfigured()) {
    throw new Error("OLLAMA_BASE_URL is not configured");
  }

  try {
    const prepared = await prepareSearchMedia(opts.media ?? null);
    media = prepared.media;
    if (prepared.processedFromMotion && media) {
      processedImage = media.data;
    }
  } catch (err) {
    console.warn("agent media prepare failed:", err);
    logSearchError(`agent media prepare · ${opts.media?.mime ?? "?"}`, err);
  }

  if (!userQ && !media) {
    throw new Error("q or media required");
  }

  // Media-only: caller should use visual search; still support if invoked.
  if (!userQ && media) {
    step("visual-only — skipping agent…");
    const { runVisualSearch } = await import("@/lib/search/run-visual");
    const vis = await runVisualSearch({
      q: "",
      media: opts.media,
      onStep: opts.onStep,
    });
    return {
      plan: { q: "", mode: "hybrid", filter: "" },
      engine: vis.engine,
      hits: vis.hits,
      facetDistribution: vis.facetDistribution,
      thoughtSteps: vis.thoughtSteps,
      usedTools: false,
      planFallback: false,
      usedVisual: true,
      processedImage: vis.processedImage,
    };
  }

  const model = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const prompts = await getResolvedSearchPrompts();

  step("warming the search brain…");
  step("peeking at what we can search…");
  if (media) step("got your visual — will fuse lookalikes too…");

  const systemExtra = media ? `\n\n${prompts.agentVisual.trim()}` : "";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${prompts.agent.trim()}

Use tools to inspect capabilities and run searches. Max ${MAX_TOOL_DEPTH} tool rounds.${systemExtra}`,
    },
    {
      role: "user",
      content: `Find stickers/collections for: ${userQ}`,
    },
  ];

  let lastSearch: Awaited<ReturnType<typeof runAgentSearchTool>> | null = null;
  let usedTools = false;
  let planFallback = false;

  try {
    for (let depth = 0; depth < MAX_TOOL_DEPTH; depth++) {
      const turn = await ollamaChatWithTools({
        model,
        messages,
        tools: SEARCH_AGENT_TOOLS,
      });
      messages.push(turn.message);

      if (!turn.toolCalls.length) break;

      usedTools = true;
      for (const call of turn.toolCalls) {
        const name = call.function.name;
        const args = parseToolArgs(call.function.arguments);
        let toolContent = "";
        if (name === "get_search_capabilities") {
          step("checking modes & filters…");
          toolContent = JSON.stringify(searchCapabilitiesPayload(opts.user));
        } else if (name === "search") {
          const q = String(args.q ?? (userQ || "sticker"));
          step(`sniffing for “${q}”…`);
          lastSearch = await runAgentSearchTool({ ...args, q });
          toolContent = JSON.stringify({
            engine: lastSearch.engine,
            hitCount: lastSearch.hitCount,
            hits: lastSearch.hits,
            mode: lastSearch.mode,
            q: lastSearch.q,
            filter: lastSearch.filter,
          });
        } else {
          toolContent = JSON.stringify({ error: `unknown tool ${name}` });
        }
        messages.push({
          role: "tool",
          tool_name: name,
          content: toolContent,
        });
      }
    }

    if (usedTools && !lastSearch) {
      step("agent hummed but never searched — using your words…");
    }
  } catch (err) {
    console.warn("agent tools failed, JSON fallback:", err);
    usedTools = false;
  }

  let plan: {
    q: string;
    mode: AgentTextMode;
    filter: string;
  } = {
    q: userQ || "sticker",
    mode: "hybrid",
    filter: "",
  };
  let textHits: FederatedHit[] = [];
  let engine: "meili" | "prisma" = "meili";
  let facetDistribution: Record<string, Record<string, number>> | undefined;

  if (lastSearch) {
    plan = {
      q: lastSearch.q,
      mode: lastSearch.mode,
      filter: lastSearch.filter,
    };
    textHits = lastSearch.hitsFull;
    engine = lastSearch.engine;
    facetDistribution = lastSearch.facetDistribution;
  } else {
    planFallback = true;
    step("agent shrugged; searching your words as-is…");
    if (userQ) {
      const planRaw = await ollamaChat({
        model,
        prompt: searchAgentPromptFromResolved(prompts, userQ, {
          hasVisual: Boolean(media),
        }),
      });
      plan = parseSearchAgentPlan(planRaw, userQ);
    }
    const result = await meiliFederatedSearch({
      q: plan.q,
      mode: plan.mode,
      filter: plan.filter || undefined,
      limit: 5,
    });
    textHits = result.hits;
    engine = result.engine;
    facetDistribution = result.facetDistribution;
  }

  let hits = textHits;
  if (media) {
    step("sniffing lookalikes from your visual…");
    try {
      const byVisual = await meiliFederatedSearch({
        q: plan.q || userQ,
        mode: "visual",
        media,
        limit: 5,
      });
      hits = mergeRrfHits([textHits, byVisual.hits], 5);
      if (byVisual.engine === "meili") engine = "meili";
      facetDistribution = facetDistribution ?? byVisual.facetDistribution;
    } catch (err) {
      console.warn("agent visual fuse failed:", err);
      step("visual sniff failed — text-only results");
    }
  }

  return {
    plan,
    engine,
    hits,
    facetDistribution,
    thoughtSteps: [],
    usedTools,
    planFallback,
    usedVisual: Boolean(media),
    processedImage,
  };
  } catch (err) {
    logSearchError(
      `agent${userQ ? ` · ${userQ.slice(0, 80)}` : ""}${opts.media?.mime ? ` · ${opts.media.mime}` : ""}`,
      err,
    );
    throw err;
  }
}
