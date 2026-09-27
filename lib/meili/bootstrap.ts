import { getMeili, isMeiliConfigured } from "@/lib/meili/client";
import { MEILI_EMBEDDER, MEILI_INDEX } from "@/lib/meili/indexes";

let bootstrapped = false;

function multimodalEmbedderSettings(): Record<string, unknown> | null {
  const url = process.env.MEILI_MULTIMODAL_URL?.trim();
  const model = process.env.MEILI_MULTIMODAL_MODEL?.trim();
  if (!url || !model) return null;
  const apiKey = process.env.MEILI_MULTIMODAL_API_KEY?.trim();
  // OpenAI-compatible /v1/embeddings — fragment value becomes `input` (array of {text|image}).
  // Matches clip-server (docker-compose.clip.yml) and similar OpenAI multimodal embed APIs.
  return {
    source: "rest",
    url: url.replace(/\/$/, "") + "/v1/embeddings",
    ...(apiKey ? { apiKey } : {}),
    indexingFragments: {
      image: {
        value: [{ image: "{{doc.previewUrl}}" }],
      },
      text: {
        value: [
          {
            text: "{{doc.title}} {{doc.aiCaption}} {{doc.tags}}",
          },
        ],
      },
    },
    searchFragments: {
      text: {
        value: [{ text: "{{q}}" }],
      },
      image: {
        value: [
          {
            image:
              "data:{{media.image.mime}};base64,{{media.image.data}}",
          },
        ],
      },
    },
    request: {
      model,
      input: "{{fragment}}",
    },
    response: {
      data: [{ embedding: "{{embedding}}" }, "{{..}}" ],
    },
  };
}

function textEmbedderSettings(): Record<string, unknown> | null {
  const ollama = process.env.OLLAMA_BASE_URL?.trim();
  if (!ollama) return null;
  const model = process.env.OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text";
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  return {
    source: "ollama",
    url: ollama.replace(/\/$/, ""),
    model,
    ...(apiKey ? { apiKey } : {}),
    documentTemplate:
      "{{doc.title}} {{doc.aiCaption}} {{doc.tags}} {{doc.description}} {{doc.keywords}}",
  };
}

/** Idempotent index + settings + experimental multimodal. Safe to call often. */
export async function ensureMeiliIndexes(): Promise<boolean> {
  if (!isMeiliConfigured()) return false;
  if (bootstrapped) return true;
  const meili = getMeili();
  if (!meili) return false;

  try {
    await meili.updateExperimentalFeatures({ multimodal: true });
  } catch (err) {
    console.warn("Meili multimodal experimental enable failed:", err);
  }

  const textEmbedder = textEmbedderSettings();
  const imageEmbedder = multimodalEmbedderSettings();

  await meili.createIndex(MEILI_INDEX.stickers, { primaryKey: "id" }).catch(() => {});
  await meili.createIndex(MEILI_INDEX.collections, { primaryKey: "id" }).catch(() => {});
  await meili.createIndex(MEILI_INDEX.prints, { primaryKey: "id" }).catch(() => {});
  await meili.createIndex(MEILI_INDEX.blobbers, { primaryKey: "id" }).catch(() => {});

  const stickerEmbedders: Record<string, unknown> = {};
  if (textEmbedder) stickerEmbedders[MEILI_EMBEDDER.text] = textEmbedder;
  if (imageEmbedder) stickerEmbedders[MEILI_EMBEDDER.image] = imageEmbedder;

  await meili.index(MEILI_INDEX.stickers).updateSettings({
    searchableAttributes: [
      "title",
      "description",
      "keywords",
      "alternateNames",
      "tags",
      "category",
      "blobber",
      "aiCaption",
      "aiScenario",
      "aiVisualTags",
    ],
    filterableAttributes: [
      "categorySlug",
      "tags",
      "blobberId",
      "mediaKind",
      "hasAudio",
    ],
    sortableAttributes: [
      "popularityScore",
      "likesCount",
      "publishedAt",
      "createdAt",
    ],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "popularityScore:desc",
    ],
    ...(Object.keys(stickerEmbedders).length
      ? { embedders: stickerEmbedders as never }
      : {}),
  });

  const textOnly = textEmbedder
    ? { embedders: { [MEILI_EMBEDDER.text]: textEmbedder } as never }
    : {};

  await meili.index(MEILI_INDEX.collections).updateSettings({
    searchableAttributes: ["name", "description", "memberText"],
    filterableAttributes: [],
    sortableAttributes: ["likesCount", "updatedAt"],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "likesCount:desc",
    ],
    ...textOnly,
  });

  await meili.index(MEILI_INDEX.prints).updateSettings({
    searchableAttributes: ["name", "description", "memberText"],
    filterableAttributes: ["kind"],
    sortableAttributes: ["likesCount", "updatedAt"],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "likesCount:desc",
    ],
    ...textOnly,
  });

  await meili.index(MEILI_INDEX.blobbers).updateSettings({
    searchableAttributes: ["displayName", "bio"],
    filterableAttributes: [],
    sortableAttributes: ["stickerCount"],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "stickerCount:desc",
    ],
  });

  bootstrapped = true;
  return true;
}
