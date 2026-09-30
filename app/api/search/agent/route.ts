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
} from "@/lib/search/agent-tools";
import {
  getResolvedSearchPrompts,
  searchAgentPromptFromResolved,
} from "@/lib/search/prompts";
import { meiliFederatedSearch } from "@/lib/search/query";
import { parseSearchAgentPlan } from "@/lib/search/vision-parse";

const MAX_TOOL_DEPTH = 2;

/**
 * Agentic search: tool loop (depth ≤ 2) then return hits.
 * Falls back to single-shot JSON plan if tools are ignored.
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
  } | null;
  const userQ = body?.q?.trim();
  if (!userQ) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const model = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";
  const prompts = await getResolvedSearchPrompts();
  const steps: string[] = ["peeking at what we can search…"];

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${prompts.agent.trim()}

Use tools to inspect capabilities and run searches. Max ${MAX_TOOL_DEPTH} tool rounds.`,
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
          steps.push("checking modes & filters…");
          toolContent = JSON.stringify(searchCapabilitiesPayload(user));
        } else if (name === "search") {
          steps.push(`sniffing for “${String(args.q ?? userQ)}”…`);
          lastSearch = await runAgentSearchTool(args);
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

    // Optional closing turn without tools (ignored if empty)
    if (usedTools && !lastSearch) {
      steps.push("agent hummed but never searched — using your words…");
    }
  } catch (err) {
    console.warn("agent tools failed, JSON fallback:", err);
    usedTools = false;
  }

  if (lastSearch) {
    return NextResponse.json({
      plan: {
        q: lastSearch.q,
        mode: lastSearch.mode,
        filter: lastSearch.filter,
      },
      engine: lastSearch.engine,
      hits: lastSearch.hitsFull,
      facetDistribution: lastSearch.facetDistribution,
      thoughtSteps: steps,
      usedTools: true,
    });
  }

  // Fallback: legacy single-shot JSON plan
  planFallback = true;
  steps.push("agent shrugged; searching your words as-is…");
  const planRaw = await ollamaChat({
    model,
    prompt: searchAgentPromptFromResolved(prompts, userQ),
  });
  const plan = parseSearchAgentPlan(planRaw, userQ);
  if (
    plan.q === userQ &&
    plan.mode === "hybrid" &&
    !plan.filter &&
    !planRaw.includes("{")
  ) {
    steps.push("plan was mush — hybrid with your query…");
  }

  const result = await meiliFederatedSearch({
    q: plan.q,
    mode: plan.mode,
    filter: plan.filter || undefined,
    limit: 5,
  });

  return NextResponse.json({
    plan,
    ...result,
    thoughtSteps: steps,
    usedTools: false,
    planFallback,
  });
}
