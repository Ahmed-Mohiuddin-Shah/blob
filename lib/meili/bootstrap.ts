import { getMeili, isMeiliConfigured } from "@/lib/meili/client";
import { MEILI_EMBEDDER, MEILI_INDEX } from "@/lib/meili/indexes";
import { logMeiliError } from "@/lib/processing-log";

let bootstrapped = false;

const STICKER_TEXT_TEMPLATE =
  "{{doc.title}} {{doc.aiCaption}} {{doc.tags}} {{doc.description}} {{doc.keywords}}";
const MEMBER_TEXT_TEMPLATE =
  "{{doc.name}} {{doc.description}} {{doc.memberText}}";

function multimodalEmbedderSettings(): Record<string, unknown> | null {
  const url = process.env.MEILI_MULTIMODAL_URL?.trim();
  const model = process.env.MEILI_MULTIMODAL_MODEL?.trim();
  if (!url || !model) return null;
  const apiKey = process.env.MEILI_MULTIMODAL_API_KEY?.trim();
  // ViT-B-32 OpenCLIP → 512; Meili cannot infer dims when using indexingFragments.
  const dimensions = Number(process.env.MEILI_MULTIMODAL_DIMENSIONS || "512") || 512;
  // One fragment → one embedding. Do NOT put "{{..}}" in response unless request
  // also batches — that causes "response has multiple embeddings, but request
  // has only one text to embed".
  return {
    source: "rest",
    url: url.replace(/\/$/, "") + "/v1/embeddings",
    dimensions,
    ...(apiKey ? { apiKey } : {}),
    indexingFragments: {
      image: {
        value: [{ image: "{{doc.clipPreviewUrl}}" }],
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
      data: [{ embedding: "{{embedding}}" }],
    },
  };
}

function textEmbedderSettings(
  documentTemplate: string,
): Record<string, unknown> | null {
  const ollama = process.env.OLLAMA_BASE_URL?.trim();
  if (!ollama) return null;
  const model = process.env.OLLAMA_EMBED_MODEL?.trim() || "nomic-embed-text";
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  const base = ollama.replace(/\/$/, "");
  // Meili `source: ollama` only allows http:// — use OpenAI-compatible REST for HTTPS.
  if (base.startsWith("https://")) {
    return {
      source: "rest",
      url: `${base}/v1/embeddings`,
      ...(apiKey ? { apiKey } : {}),
      documentTemplate,
      request: {
        model,
        input: ["{{text}}", "{{..}}"],
      },
      response: {
        data: [
          {
            embedding: "{{embedding}}",
          },
          "{{..}}",
        ],
      },
    };
  }
  return {
    source: "ollama",
    url: base,
    model,
    ...(apiKey ? { apiKey } : {}),
    documentTemplate,
  };
}

/** Idempotent index + settings + experimental multimodal. Safe to call often. */
export async function ensureMeiliIndexes(): Promise<boolean> {
  if (!isMeiliConfigured()) return false;
  if (bootstrapped) return true;
  const meili = getMeili();
  if (!meili) return false;

  try {
    try {
      await meili.updateExperimentalFeatures({ multimodal: true });
    } catch (err) {
      console.warn("Meili multimodal experimental enable failed:", err);
    }

    const stickerText = textEmbedderSettings(STICKER_TEXT_TEMPLATE);
    const memberText = textEmbedderSettings(MEMBER_TEXT_TEMPLATE);
    const imageEmbedder = multimodalEmbedderSettings();

    await meili.createIndex(MEILI_INDEX.stickers, { primaryKey: "id" }).catch(() => {});
    await meili.createIndex(MEILI_INDEX.collections, { primaryKey: "id" }).catch(() => {});
    await meili.createIndex(MEILI_INDEX.prints, { primaryKey: "id" }).catch(() => {});
    await meili.createIndex(MEILI_INDEX.blobbers, { primaryKey: "id" }).catch(() => {});

    // Core settings first — keyword search must work even if embedders fail.
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
        "id",
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
      // Short plurals get no typo tolerance — map cats → cat for keyword hits.
      synonyms: {
        cats: ["cat"],
      },
    });

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
    });

    await meili.index(MEILI_INDEX.blobbers).updateSettings({
      searchableAttributes: ["displayName", "slug", "bio"],
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

    // Embedders validate against live Ollama/CLIP — set one at a time so a bad
    // multimodal config cannot block the text embedder (hybrid/semantic).
    const client = meili;
    async function applyEmbedder(
      uid: string,
      name: string,
      settings: Record<string, unknown>,
    ) {
      // Client HTTP timeout is 120s; waitTask defaults to 5s and fails cold Ollama/CLIP.
      const task = await client
        .index(uid)
        .updateEmbedders({ [name]: settings } as never)
        .waitTask({ timeout: 120_000 });
      if (task.status === "failed") {
        throw new Error(
          task.error?.message ?? `Meili embedder ${uid}/${name} failed`,
        );
      }
    }

    if (stickerText) {
      try {
        await applyEmbedder(
          MEILI_INDEX.stickers,
          MEILI_EMBEDDER.text,
          stickerText,
        );
      } catch (err) {
        console.warn(`Meili stickers text embedder failed:`, err);
        logMeiliError("stickers text embedder", err);
      }
    }
    if (memberText) {
      for (const uid of [MEILI_INDEX.collections, MEILI_INDEX.prints]) {
        try {
          await applyEmbedder(uid, MEILI_EMBEDDER.text, memberText);
        } catch (err) {
          console.warn(`Meili ${uid} text embedder failed:`, err);
          logMeiliError(`${uid} text embedder`, err);
        }
      }
    }
    if (imageEmbedder) {
      try {
        await applyEmbedder(
          MEILI_INDEX.stickers,
          MEILI_EMBEDDER.image,
          imageEmbedder,
        );
      } catch (err) {
        console.warn("Meili sticker image embedder failed:", err);
        logMeiliError("sticker image embedder", err);
      }
    }

    bootstrapped = true;
    return true;
  } catch (err) {
    console.error("Meili bootstrap failed:", err);
    logMeiliError("bootstrap", err);
    return false;
  }
}
