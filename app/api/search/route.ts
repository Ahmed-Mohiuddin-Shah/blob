import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  allowedSearchModes,
  canUseSearchMode,
  type CapabilityUser,
} from "@/lib/capabilities";
import { MEILI_INDEX } from "@/lib/meili/indexes";
import {
  meiliFederatedSearch,
  meiliScopedSearch,
  normalizeSearchMode,
} from "@/lib/search/query";

const MODES = new Set(["keywords", "hybrid", "semantic", "visual", "image"]);

function searchError(err: unknown) {
  const message = err instanceof Error ? err.message : "Search failed";
  console.error("search route:", err);
  return NextResponse.json({ error: message }, { status: 500 });
}

async function capUser(request: Request): Promise<CapabilityUser | null> {
  const session = await getSession(request);
  if (!session?.user?.id) return null;
  return {
    role: session.user.role ?? "user",
    accountStatus: session.user.accountStatus ?? "active",
  };
}

function forbidMode(user: CapabilityUser | null, mode: string) {
  const allowed = [...allowedSearchModes(user)];
  return NextResponse.json(
    {
      error: `Search mode "${mode}" requires a higher account tier`,
      allowedModes: allowed,
    },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const modeRaw = url.searchParams.get("mode") ?? "hybrid";
    const mode = MODES.has(modeRaw)
      ? normalizeSearchMode(modeRaw)
      : ("hybrid" as const);
    const limit = Math.min(
      48,
      Math.max(1, Number(url.searchParams.get("limit") ?? "24") || 24),
    );
    const scope = url.searchParams.get("scope"); // stickers|collections|prints|blobbers|all
    const filter = url.searchParams.get("filter") ?? undefined;
    const suggest = url.searchParams.get("suggest") === "1";

    if (suggest) {
      // Typeahead stays keywords — cheap for everyone.
      const result = await meiliScopedSearch({
        index: "stickers",
        q,
        mode: "keywords",
        limit: 8,
      });
      return NextResponse.json({
        engine: result.engine,
        suggestions: result.hits.map((h) => ({
          id: h.id,
          slug: h.slug,
          title: h.title ?? h.name,
        })),
      });
    }

    const user = await capUser(request);
    if (!canUseSearchMode(user, mode)) {
      return forbidMode(user, mode);
    }

    if (
      scope === "stickers" ||
      scope === "collections" ||
      scope === "prints" ||
      scope === "blobbers"
    ) {
      const result = await meiliScopedSearch({
        index: scope,
        q,
        mode,
        limit,
        filter,
      });
      return NextResponse.json(result);
    }

    const result = await meiliFederatedSearch({ q, mode, limit, filter });
    return NextResponse.json(result);
  } catch (err) {
    return searchError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      q?: string;
      mode?: string;
      limit?: number;
      filter?: string;
      media?: { mime: string; data: string };
    } | null;

    const mode = normalizeSearchMode(body?.mode ?? "visual");
    const user = await capUser(request);
    if (!canUseSearchMode(user, mode)) {
      return forbidMode(user, mode);
    }

    const { prepareSearchMedia } = await import("@/lib/search/prepare-media");
    const prepared = await prepareSearchMedia(body?.media ?? null);

    const result = await meiliFederatedSearch({
      q: body?.q ?? "",
      mode,
      limit: body?.limit ?? 5,
      filter: body?.filter,
      media: prepared.media ?? undefined,
    });
    return NextResponse.json({
      ...result,
      processedImage: prepared.processedFromMotion
        ? prepared.media?.data
        : undefined,
    });
  } catch (err) {
    return searchError(err);
  }
}
