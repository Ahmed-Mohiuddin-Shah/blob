import type { CapabilityUser } from "@/lib/capabilities";
import { allowedSearchModes } from "@/lib/capabilities";
import type { OllamaToolDef } from "@/lib/ollama/tools";
import {
  meiliFederatedSearch,
  type SearchMode,
} from "@/lib/search/query";

export const SEARCH_AGENT_TOOLS: OllamaToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_search_capabilities",
      description:
        "List allowed search modes for this user and Meili filter fields for stickers.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description:
        "Run federated sticker/collection/print search. mode must be one of keywords|hybrid|semantic.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search query" },
          mode: {
            type: "string",
            enum: ["keywords", "hybrid", "semantic"],
          },
          filter: {
            type: "string",
            description:
              'Optional Meili filter e.g. mediaKind = "gif" OR categorySlug = "reactions"',
          },
          limit: { type: "number" },
        },
        required: ["q", "mode"],
      },
    },
  },
];

export function searchCapabilitiesPayload(user: CapabilityUser | null) {
  const modes = [...allowedSearchModes(user)].filter(
    (m) => m !== "visual" && m !== "agent",
  );
  return {
    modes,
    filterFields: {
      mediaKind: ['"image"', '"gif"', '"video"'],
      categorySlug: "category slug string",
      tags: "tag name; use tags = \"NAME\"",
      hasAudio: "true | false",
      blobberId: "numeric id as string",
    },
    filterExamples: [
      'mediaKind = "gif"',
      'categorySlug = "reactions"',
      'tags = "CAT"',
    ],
  };
}

export type AgentTextMode = "keywords" | "hybrid" | "semantic";

export async function runAgentSearchTool(args: {
  q?: string;
  mode?: string;
  filter?: string;
  limit?: number;
}) {
  const q = (args.q ?? "").trim();
  const mode: AgentTextMode = (
    ["keywords", "hybrid", "semantic"].includes(args.mode ?? "")
      ? args.mode
      : "hybrid"
  ) as AgentTextMode;
  const result = await meiliFederatedSearch({
    q,
    mode: mode as SearchMode,
    filter: args.filter?.trim() || undefined,
    limit: Math.min(5, Math.max(1, Number(args.limit) || 5)),
  });
  return {
    engine: result.engine,
    mode,
    q,
    filter: args.filter?.trim() || "",
    hitCount: result.hits.length,
    hits: result.hits.slice(0, 8).map((h) => ({
      index: h.index,
      id: h.id,
      title: h.title ?? h.name ?? h.displayName,
      slug: h.slug,
    })),
    hitsFull: result.hits,
    facetDistribution: result.facetDistribution,
  };
}
