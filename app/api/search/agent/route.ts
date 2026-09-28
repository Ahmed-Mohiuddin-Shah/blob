import { NextResponse } from "next/server";
import { isOllamaConfigured, ollamaChat } from "@/lib/ollama/client";
import {
  getResolvedSearchPrompts,
  searchAgentPromptFromResolved,
} from "@/lib/search/prompts";
import { meiliFederatedSearch } from "@/lib/search/query";

/**
 * Agentic search: small Ollama model plans a Meili query, then we run it.
 * ponytail: single tool round-trip, not a full agent loop.
 */
export async function POST(request: Request) {
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
  const planRaw = await ollamaChat({
    model,
    prompt: searchAgentPromptFromResolved(prompts, userQ),
  });

  let plan = {
    q: userQ,
    mode: "hybrid" as const,
    filter: "",
  };
  try {
    const start = planRaw.indexOf("{");
    const end = planRaw.lastIndexOf("}");
    const parsed = JSON.parse(
      start >= 0 && end > start ? planRaw.slice(start, end + 1) : planRaw,
    ) as { q?: string; mode?: string; filter?: string };
    plan = {
      q: parsed.q?.trim() || userQ,
      mode: (["hybrid", "semantic", "keywords"].includes(parsed.mode ?? "")
        ? parsed.mode
        : "hybrid") as "hybrid",
      filter: parsed.filter?.trim() || "",
    };
  } catch {
    /* use defaults */
  }

  const result = await meiliFederatedSearch({
    q: plan.q,
    mode: plan.mode,
    filter: plan.filter || undefined,
    limit: 24,
  });

  return NextResponse.json({
    plan,
    ...result,
  });
}
