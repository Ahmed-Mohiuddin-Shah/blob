import { NextResponse } from "next/server";
import {
  meiliFederatedSearch,
  meiliScopedSearch,
  type SearchMode,
} from "@/lib/search/query";
import { MEILI_INDEX } from "@/lib/meili/indexes";

const MODES = new Set(["keywords", "hybrid", "semantic", "image"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const modeRaw = url.searchParams.get("mode") ?? "hybrid";
  const mode = (MODES.has(modeRaw) ? modeRaw : "hybrid") as SearchMode;
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit") ?? "24") || 24));
  const scope = url.searchParams.get("scope"); // stickers|collections|prints|blobbers|all
  const filter = url.searchParams.get("filter") ?? undefined;
  const suggest = url.searchParams.get("suggest") === "1";

  if (suggest) {
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

  if (scope && scope !== "all" && scope in MEILI_INDEX === false) {
    // scope is uid string
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
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    q?: string;
    mode?: string;
    limit?: number;
    filter?: string;
    media?: { mime: string; data: string };
  } | null;

  const modeRaw = body?.mode ?? "image";
  const mode = (MODES.has(modeRaw) ? modeRaw : "image") as SearchMode;
  const result = await meiliFederatedSearch({
    q: body?.q ?? "",
    mode,
    limit: body?.limit ?? 24,
    filter: body?.filter,
    media: body?.media,
  });
  return NextResponse.json(result);
}
