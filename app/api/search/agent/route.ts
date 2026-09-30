import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseSearchMode, type CapabilityUser } from "@/lib/capabilities";
import { isOllamaConfigured, ollamaChat } from "@/lib/ollama/client";
import {
  ollamaChatWithTools,
  parseToolArgs,
  type ChatMessage,
} from "@/lib/ollama/tools";
import {
  runAgentSearchTool,
  SEARCH_AGENT_TOOLS,
  searchCapabilitiesPayload,
  type AgentTextMode,
} from "@/lib/search/agent-tools";
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

type MediaIn = { mime: string; data: string };

async function prepareMedia(media?: MediaIn | null): Promise<MediaIn | null> {
  if (!media?.data || !media.mime) return null;
  const { isMotionMime, storyboardBase64 } = await import(
    "@/lib/search/storyboard"
  );
  if (isMotionMime(media.mime)) {
    const jpegB64 = await storyboardBase64(
      Buffer.from(media.data, "base64"),
      media.mime,
    );
    return { mime: "image/jpeg", data: jpegB64 };
  }
  return media;
}

/**
 * Agentic search: tool loop (depth ≤ 2), then fuse with image search if media attached.
 */
export async function POST(request: Request) {
  const session = await getSession(request);
  const user: CapabilityUser | null = session?.user?.id
    ? {
        role: session.user.role ?? "user",
        accountStatus: session.user.accountStatus ?? "active",
      }
    : null;
  if (!canUseSearchMode(user, "agent")) {
    return NextResponse.json(
      {
        error: "Agent search requires a member account",
        allowedModes: ["keywords", "semantic"].filter((m) =>
          canUseSearchMode(user, m),
        ),
      },
      { status: 403 },
    );
  }

  if (!isOllamaConfigured()) {
    return NextResponse.json(
      { error: "OLLAMA_BASE_URL is not configured" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    q?: string;
    media?: MediaIn;
  } | null;
  const userQ = body?.q?.trim() ?? "";
  let media: MediaIn | null = null;
  try {
    media = await prepareMedia(body?.media ?? null);
  } catch (err) {
    console.warn("agent media prepare failed:", err);
  }

  if (!userQ && !media) {
    return NextResponse.json(
      { error: "q or media required" },
      { status: 400 },
    );
  }

  const model = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const prompts = await getResolvedSearchPrompts();
  const steps: string[] = ["peeking at what we can search…"];
  if (media) steps.push("got your pic — will fuse lookalikes too…");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${prompts.agent.trim()}

Use tools to inspect capabilities and run searches. Max ${MAX_TOOL_DEPTH} tool rounds.
${media ? "The user also attached an image; text search results will be fused with image similarity — still plan a good text/hybrid query." : ""}`,
    },
    {
      role: "user",
      content: userQ
        ? `Find stickers/collections for: ${userQ}`
        : "Find stickers similar to the attached image.",
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
          steps.push("checking modes & filters…");
          toolContent = JSON.stringify(searchCapabilitiesPayload(user));
        } else if (name === "search") {
          const q = String(args.q ?? (userQ || "sticker"));
          steps.push(`sniffing for “${q}”…`);
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
      steps.push("agent hummed but never searched — using your words…");
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
    steps.push("agent shrugged; searching your words as-is…");
    if (userQ) {
      const planRaw = await ollamaChat({
        model,
        prompt: searchAgentPromptFromResolved(prompts, userQ),
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
    steps.push("sniffing lookalikes from your pic…");
    try {
      const byImage = await meiliFederatedSearch({
        q: plan.q || userQ,
        mode: "image",
        media,
        limit: 5,
      });
      hits = mergeRrfHits([textHits, byImage.hits], 5);
      if (byImage.engine === "meili") engine = "meili";
      facetDistribution = facetDistribution ?? byImage.facetDistribution;
    } catch (err) {
      console.warn("agent image fuse failed:", err);
      steps.push("pic sniff failed — text-only results");
    }
  }

  return NextResponse.json({
    plan,
    engine,
    hits,
    facetDistribution,
    thoughtSteps: steps,
    usedTools,
    planFallback,
    usedImage: Boolean(media),
  });
}
