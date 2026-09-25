import { createHash } from "crypto";
import {
  remixDeepCopy,
  validateDocument,
  type CompositionDocument,
} from "blob-editor/core";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import { ensurePrivatePrism } from "@/lib/private-prism";
import {
  detectUpload,
  MAX_UPLOAD_BYTES,
  normalizeTagName,
  slugify,
  tagSlug,
  VISIBILITIES,
  type Visibility,
} from "@/lib/stickers";
import { parseAttributionInput } from "@/lib/attribution";

export async function uniqueStickerSlug(title: string): Promise<string> {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.sticker.findUnique({ where: { slug } });
    if (!taken) return slug;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

export async function upsertTagsForSticker(
  stickerId: bigint,
  tagNames: string[],
) {
  for (const name of tagNames) {
    const display = normalizeTagName(name);
    const tSlug = tagSlug(display);
    if (!tSlug || !display) continue;
    const tag = await prisma.tag.upsert({
      where: { slug: tSlug },
      create: { slug: tSlug, name: display },
      update: { name: display },
    });
    await prisma.stickerTag.upsert({
      where: {
        stickerId_tagId: { stickerId, tagId: tag.id },
      },
      create: { stickerId, tagId: tag.id },
      update: {},
    });
  }
}

export function parseTagNames(raw: string): string[] {
  return raw
    .split(/[,#\n]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function parseVisibility(raw: string): Visibility {
  return (
    VISIBILITIES.includes(raw as Visibility) ? raw : "public"
  ) as Visibility;
}

export { parseAttributionInput };

/** Upload immutable original into `assets` + GLASS. */
export async function createAssetFromBytes(opts: {
  userId: bigint;
  glassPrivatePrismId: string | null;
  bytes: Uint8Array;
  declaredMime: string;
  title?: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}): Promise<{ id: string; mime: string; kind: "image" | "gif" | "video" }> {
  if (opts.bytes.length === 0 || opts.bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error("File empty or too large (max 20 MiB)");
  }
  const detected = detectUpload(opts.bytes, opts.declaredMime);
  if (!detected) {
    throw new Error("Unsupported file type (png, jpeg, webp, gif, mp4)");
  }
  const prismId = await ensurePrivatePrism(
    opts.userId,
    opts.glassPrivatePrismId,
  );
  const glass = getGlass();
  const uploaded = await glass.objects.upload({
    prismId,
    file: opts.bytes,
    title: opts.title ?? `asset-${detected.ext}`,
    filename: `asset.${detected.ext}`,
  });
  const sha = createHash("sha256").update(opts.bytes).digest("hex");
  const asset = await prisma.asset.create({
    data: {
      uploadedById: opts.userId,
      sha256: sha,
      mimeType: detected.mime,
      fileExtension: detected.ext,
      width: opts.width ?? null,
      height: opts.height ?? null,
      durationMs: opts.durationMs ?? null,
      sizeBytes: BigInt(uploaded.size ?? opts.bytes.length),
      glassObjectId: uploaded.object_id,
      glassPrismId: prismId,
    },
  });
  return { id: asset.id.toString(), mime: detected.mime, kind: detected.kind };
}

/** Persist client still PNG exports as provisional media for a revision. */
export async function upsertStillExports(opts: {
  stickerId: bigint;
  revisionId: bigint;
  slug: string;
  prismId: string;
  chat: Uint8Array;
  thumbnail: Uint8Array;
  full: Uint8Array;
  mask?: Uint8Array;
}) {
  const glass = getGlass();
  await preservePreviousThumbnail(opts.stickerId, opts.revisionId);

  const items: { kind: string; bytes: Uint8Array; w: number; h: number }[] = [
    { kind: "chat", bytes: opts.chat, w: 128, h: 128 },
    { kind: "thumbnail", bytes: opts.thumbnail, w: 256, h: 256 },
    { kind: "image", bytes: opts.full, w: 1024, h: 1024 },
  ];
  if (opts.mask) {
    items.push({ kind: "mask", bytes: opts.mask, w: 1024, h: 1024 });
  }
  for (const item of items) {
    const up = await glass.objects.upload({
      prismId: opts.prismId,
      file: item.bytes,
      title: `${opts.slug}-${item.kind}`,
      filename: `${opts.slug}-${item.kind}.png`,
      fileExtension: "png",
    });
    await prisma.mediaAsset.upsert({
      where: {
        stickerId_kind: { stickerId: opts.stickerId, kind: item.kind },
      },
      create: {
        stickerId: opts.stickerId,
        compositionRevisionId: opts.revisionId,
        kind: item.kind,
        mimeType: "image/png",
        fileExtension: "png",
        width: item.w,
        height: item.h,
        sizeBytes: BigInt(item.bytes.length),
        checksumSha256: createHash("sha256").update(item.bytes).digest("hex"),
        glassObjectId: up.object_id,
        glassPrismId: opts.prismId,
        status: "ready",
      },
      update: {
        compositionRevisionId: opts.revisionId,
        sizeBytes: BigInt(item.bytes.length),
        checksumSha256: createHash("sha256").update(item.bytes).digest("hex"),
        glassObjectId: up.object_id,
        glassPrismId: opts.prismId,
        status: "ready",
        width: item.w,
        height: item.h,
      },
    });
  }
}

/** Keep prior thumbnail under prev_thumbnail for open-queue still diffs (unique kind constraint). */
async function preservePreviousThumbnail(
  stickerId: bigint,
  newRevisionId: bigint,
) {
  const existing = await prisma.mediaAsset.findUnique({
    where: { stickerId_kind: { stickerId, kind: "thumbnail" } },
  });
  if (
    !existing ||
    !existing.compositionRevisionId ||
    existing.compositionRevisionId === newRevisionId
  ) {
    return;
  }
  const oldPrev = await prisma.mediaAsset.findUnique({
    where: { stickerId_kind: { stickerId, kind: "prev_thumbnail" } },
  });
  if (oldPrev) {
    await prisma.mediaAsset.delete({ where: { id: oldPrev.id } });
  }
  await prisma.mediaAsset.update({
    where: { id: existing.id },
    data: { kind: "prev_thumbnail" },
  });
}

export function parseDocumentJson(raw: unknown): CompositionDocument {
  return validateDocument(raw);
}

export function remixDocument(source: CompositionDocument): CompositionDocument {
  return remixDeepCopy(source);
}
