import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseSearchMode, type CapabilityUser } from "@/lib/capabilities";
import { isOllamaConfigured } from "@/lib/ollama/client";
import { runAgentSearch } from "@/lib/search/run-agent";
import { runVisualSearch } from "@/lib/search/run-visual";

type MediaIn = { mime: string; data: string };

/**
 * Agentic search (HTTP). UI prefers /api/search/ws for live steps.
 * Media-only → visual search.
 */
export async function POST(request: Request) {
  const session = await getSession(request);
  const user: CapabilityUser | null = session?.user?.id
    ? {
        role: session.user.role ?? "user",
        accountStatus: session.user.accountStatus ?? "active",
      }
    : null;
  if (!canUseSearchMode(user, "agent") && !canUseSearchMode(user, "visual")) {
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

  const body = (await request.json().catch(() => null)) as {
    q?: string;
    media?: MediaIn;
  } | null;
  const userQ = body?.q?.trim() ?? "";
  const media = body?.media ?? null;

  if (!userQ && !media) {
    return NextResponse.json(
      { error: "q or media required" },
      { status: 400 },
    );
  }

  try {
    if (media && !userQ) {
      if (!canUseSearchMode(user, "visual")) {
        return NextResponse.json(
          { error: "Visual search requires a member account" },
          { status: 403 },
        );
      }
      const steps: string[] = [];
      const result = await runVisualSearch({
        q: "",
        media,
        onStep: (l) => steps.push(l),
      });
      return NextResponse.json({
        plan: { q: "", mode: "hybrid", filter: "" },
        engine: result.engine,
        hits: result.hits,
        facetDistribution: result.facetDistribution,
        thoughtSteps: steps,
        usedTools: false,
        planFallback: false,
        usedVisual: true,
        agentSkipped: true,
        processedImage: result.processedImage,
      });
    }

    if (!canUseSearchMode(user, "agent")) {
      return NextResponse.json(
        { error: "Agent search requires a member account" },
        { status: 403 },
      );
    }
    if (!isOllamaConfigured()) {
      return NextResponse.json(
        { error: "OLLAMA_BASE_URL is not configured" },
        { status: 503 },
      );
    }

    const steps: string[] = [];
    const result = await runAgentSearch({
      q: userQ,
      media,
      user,
      onStep: (l) => steps.push(l),
    });
    return NextResponse.json({
      plan: result.plan,
      engine: result.engine,
      hits: result.hits,
      facetDistribution: result.facetDistribution,
      thoughtSteps: steps,
      usedTools: result.usedTools,
      planFallback: result.planFallback,
      usedVisual: result.usedVisual,
      processedImage: result.processedImage,
    });
  } catch (err) {
    console.error("agent search:", err);
    const { logSearchError } = await import("@/lib/processing-log");
    logSearchError(
      `agent http${userQ ? ` · ${userQ.slice(0, 80)}` : ""}${media ? ` · ${media.mime}` : ""}`,
      err,
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent search failed" },
      { status: 500 },
    );
  }
}
