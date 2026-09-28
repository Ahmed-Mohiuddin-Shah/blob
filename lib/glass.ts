import { Glass } from "glass-ts";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { VISIBILITY } from "@/lib/stickers";

export const GLASS_UPLOAD_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const;

export type GlassUploadStatus =
  (typeof GLASS_UPLOAD_STATUS)[keyof typeof GLASS_UPLOAD_STATUS];

export function getGlass(): Glass {
  const baseUrl = process.env.GLASS_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.GLASS_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Missing GLASS_API_URL or GLASS_API_KEY");
  }
  return new Glass({ baseUrl, apiKey });
}

/** Public anonymous download URL for an object in a public PRISM. */
export function glassPublicObjectUrl(objectId: string): string {
  const baseUrl = process.env.GLASS_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Missing GLASS_API_URL");
  }
  return `${baseUrl}/objects/${objectId}`;
}

/** Process-local cache of the app public PRISM UUID (from `public_prism`). */
let cachedPublicPrismId: string | null = null;

const PUBLIC_LABEL = "blob-public";

/**
 * App-owned public GLASS PRISM: one row in `public_prism`.
 * Created via glass-ts on first use; never configured via env.
 */
export async function getPublicPrismId(): Promise<string> {
  if (cachedPublicPrismId) return cachedPublicPrismId;

  const existing = await prisma.publicPrism.findUnique({
    where: { key: "default" },
  });
  if (existing) {
    cachedPublicPrismId = existing.glassPrismId;
    return cachedPublicPrismId;
  }

  const glass = getGlass();
  const prism = await glass.prisms.create({
    label: PUBLIC_LABEL,
    is_public: true,
  });

  try {
    await prisma.publicPrism.create({
      data: {
        key: "default",
        glassPrismId: prism.id,
        label: PUBLIC_LABEL,
      },
    });
    cachedPublicPrismId = prism.id;
    return cachedPublicPrismId;
  } catch {
    // Race: another process inserted first — use that row
    const row = await prisma.publicPrism.findUnique({
      where: { key: "default" },
    });
    if (!row) throw new Error("Failed to create or load public_prism");
    cachedPublicPrismId = row.glassPrismId;
    return cachedPublicPrismId;
  }
}

/** @internal test helper */
export function clearPublicPrismCache(): void {
  cachedPublicPrismId = null;
}

type LinkableMedia = {
  id: bigint;
  glassObjectId: string;
  glassPrismId: string;
};

/** Move media onto the app public PRISM so anonymous `/objects/:id` works. */
export async function linkMediaToPublicPrism(
  assets: LinkableMedia[],
): Promise<string> {
  const publicId = await getPublicPrismId();
  const glass = getGlass();
  for (const asset of assets) {
    if (!asset.glassObjectId || asset.glassPrismId === publicId) continue;
    await glass.prisms.linkObject(publicId, asset.glassObjectId);
    if (asset.glassPrismId !== publicId) {
      try {
        await glass.prisms.unlinkObject(
          asset.glassPrismId,
          asset.glassObjectId,
        );
      } catch {
        // ponytail: unlink best-effort; object may stay on private prism too
      }
    }
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { glassPrismId: publicId },
    });
  }
  return publicId;
}

/**
 * After encode/OG backfill on an already-approved public sticker, re-link
 * media — approve only runs once and won't catch new object ids.
 */
export async function ensurePublicStickerMediaLinked(
  stickerId: bigint,
): Promise<void> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: {
      visibility: true,
      moderationStatus: true,
      media: {
        select: { id: true, glassObjectId: true, glassPrismId: true },
      },
    },
  });
  if (
    !sticker ||
    sticker.visibility !== VISIBILITY.public ||
    sticker.moderationStatus !== MODERATION_STATUS.approved
  ) {
    return;
  }
  await linkMediaToPublicPrism(sticker.media);
}

/** Prism to upload into: public if already published public, else fallback. */
export async function encodePrismIdForSticker(
  stickerId: bigint,
  fallbackPrismId: string | null | undefined,
): Promise<string | null> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: { visibility: true, moderationStatus: true },
  });
  if (
    sticker?.visibility === VISIBILITY.public &&
    sticker.moderationStatus === MODERATION_STATUS.approved
  ) {
    return getPublicPrismId();
  }
  return fallbackPrismId ?? null;
}
