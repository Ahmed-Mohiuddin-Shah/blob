/**
 * Persist MEDIA_KIND.storyboard JPEG on Glass for gif/video stickers.
 */
import { createHash } from "node:crypto";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import { buildStoryboardJpeg } from "@/lib/search/storyboard";
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
} from "@/lib/stickers";

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function encodePrismId(stickerId: bigint): Promise<string | null> {
  const row = await prisma.mediaAsset.findFirst({
    where: { stickerId },
    select: { glassPrismId: true },
  });
  return row?.glassPrismId ?? null;
}

/** Build/upload storyboard if sticker has gif or video. Returns glass object id or null. */
export async function ensureStickerStoryboard(
  stickerId: bigint,
  opts?: { force?: boolean },
): Promise<string | null> {
  const media = await prisma.mediaAsset.findMany({
    where: { stickerId, status: MEDIA_ASSET_STATUS.ready },
  });
  const existing = media.find((m) => m.kind === MEDIA_KIND.storyboard);
  if (existing && !opts?.force) return existing.glassObjectId;

  const source =
    media.find((m) => m.kind === MEDIA_KIND.gif) ??
    media.find((m) => m.kind === MEDIA_KIND.video);
  if (!source) return null;

  const glass = getGlass();
  const res = await glass.objects.download(source.glassObjectId);
  const bytes = Buffer.from(await res.arrayBuffer());
  const mime = source.mimeType || "image/gif";

  const jpeg = await buildStoryboardJpeg(bytes, mime);
  const prismId = source.glassPrismId || (await encodePrismId(stickerId));
  if (!prismId) throw new Error("No Glass prism for storyboard upload");

  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: { slug: true },
  });
  const slug = sticker?.slug ?? stickerId.toString();

  const up = await glass.objects.upload({
    prismId,
    file: jpeg,
    title: `${slug}-storyboard`,
    filename: `${slug}-storyboard.jpg`,
    fileExtension: "jpg",
  });
  const objectId = (up as { object_id?: string; id?: string }).object_id ??
    (up as { id?: string }).id;
  if (!objectId) throw new Error("Glass upload missing object id");

  await prisma.mediaAsset.upsert({
    where: {
      stickerId_kind: { stickerId, kind: MEDIA_KIND.storyboard },
    },
    create: {
      stickerId,
      kind: MEDIA_KIND.storyboard,
      glassObjectId: objectId,
      glassPrismId: prismId,
      mimeType: "image/jpeg",
      fileExtension: "jpg",
      width: 510,
      height: 340,
      sizeBytes: BigInt(jpeg.byteLength),
      checksumSha256: sha256Hex(jpeg),
      status: MEDIA_ASSET_STATUS.ready,
    },
    update: {
      glassObjectId: objectId,
      glassPrismId: prismId,
      mimeType: "image/jpeg",
      fileExtension: "jpg",
      width: 510,
      height: 340,
      sizeBytes: BigInt(jpeg.byteLength),
      checksumSha256: sha256Hex(jpeg),
      status: MEDIA_ASSET_STATUS.ready,
    },
  });

  return objectId;
}
