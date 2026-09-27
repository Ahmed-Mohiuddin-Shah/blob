export const MEILI_INDEX = {
  stickers: "stickers",
  collections: "collections",
  prints: "prints",
  blobbers: "blobbers",
} as const;

export type MeiliIndexUid =
  (typeof MEILI_INDEX)[keyof typeof MEILI_INDEX];

export const MEILI_EMBEDDER = {
  text: "text",
  image: "image",
} as const;
