import { createHash } from "crypto";
import { loadImage } from "@napi-rs/canvas";
import {
  encodeComposition,
  compositionNeedsAnimatedEncode,
  type AssetBytesResolver,
} from "blob-editor/encode";
import { validateDocument, type CompositionDocument } from "blob-editor/core";
import { encodeGifFromComposition } from "@/lib/encode-gif";
import { getGlass } from "@/lib/glass";
import { ensureNodeCanvas } from "@/lib/node-canvas";
import { prisma } from "@/lib/prisma";

// napi Image is CanvasImageSource-compatible at runtime; DOM typings disagree.
type FrameResolver = (
  assetId: string,
) => CanvasImageSource | null | Promise<CanvasImageSource | null>;

/**
 * ponytail: in-process encode instead of BullMQ.
 * Uses blob-editor/encode + @napi-rs/canvas. Upgrade: separate worker when volume needs isolation.
 */
export function enqueueCompositionEncode(stickerId: bigint): void {
  void processComposition(stickerId).catch((err) => {
    console.error("Composition encode failed:", stickerId.toString(), err);
  });
}

/** @deprecated alias for callers still importing the stub name */
export const enqueueStickerProcessing = enqueueCompositionEncode;

async function processComposition(stickerId: bigint): Promise<void> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: {
      composition: {
        include: {
          revisions: { orderBy: { revision: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!sticker?.composition) {
    await fail(stickerId, "Missing composition");
    return;
  }

  const comp = sticker.composition;
  const revision =
    comp.revisions[0] ??
    (comp.currentRevisionId
      ? await prisma.compositionRevision.findUnique({
          where: { id: comp.currentRevisionId },
        })
      : null);
  if (!revision) {
    await fail(stickerId, "Missing composition revision");
    return;
  }

  let doc: CompositionDocument;
  try {
    doc = validateDocument(revision.documentJson);
  } catch (err) {
    await fail(
      stickerId,
      err instanceof Error ? err.message : "Invalid document",
    );
    return;
  }

  try {
    ensureNodeCanvas();
    const glass = getGlass();
    const assetIds = collectAssetIds(doc);
    const images = new Map<string, Awaited<ReturnType<typeof loadImage>>>();
    const bytesCache = new Map<string, Uint8Array>();

    for (const id of assetIds) {
      const asset = await prisma.asset.findUnique({ where: { id: BigInt(id) } });
      if (!asset) continue;
      const res = await glass.objects.download(asset.glassObjectId);
      const bytes = new Uint8Array(await res.arrayBuffer());
      bytesCache.set(id, bytes);
      if (
        asset.mimeType.startsWith("image/") &&
        asset.mimeType !== "image/gif"
      ) {
        images.set(id, await loadImage(Buffer.from(bytes)));
      } else if (asset.mimeType === "image/gif") {
        // gifenc/ffmpeg path still needs a still; first frame via loadImage when possible
        try {
          images.set(id, await loadImage(Buffer.from(bytes)));
        } catch {
          /* animated encode may use bytesResolver */
        }
      }
    }

    const frameResolver: FrameResolver = async (assetId) =>
      (images.get(assetId) as unknown as CanvasImageSource) ?? null;
    const bytesResolver: AssetBytesResolver = async (assetId) =>
      bytesCache.get(assetId) ?? null;

    const encoded = await encodeComposition(doc, frameResolver, bytesResolver);

    // Video stickers also get a lightweight GIF (package only emits gif for kind===gif).
    if (encoded.exports.video && !encoded.exports.gif) {
      encoded.exports.gif = await encodeGifFromComposition(doc, frameResolver);
      encoded.meta.mimeTypes.gif = "image/gif";
    }

    const prismId =
      (
        await prisma.asset.findFirst({
          where: { id: { in: assetIds.map((a) => BigInt(a)) } },
          select: { glassPrismId: true },
        })
      )?.glassPrismId ??
      (
        await prisma.mediaAsset.findFirst({
          where: { stickerId },
          select: { glassPrismId: true },
        })
      )?.glassPrismId;

    if (!prismId) {
      await fail(stickerId, "No GLASS prism for uploads");
      return;
    }

    const kinds: {
      kind: string;
      bytes: Uint8Array;
      mime: string;
      ext: string;
      w?: number;
      h?: number;
    }[] = [
      { kind: "chat", bytes: encoded.exports.chat, mime: "image/png", ext: "png", w: 128, h: 128 },
      {
        kind: "thumbnail",
        bytes: encoded.exports.thumbnail,
        mime: "image/png",
        ext: "png",
        w: 256,
        h: 256,
      },
      {
        kind: "image",
        bytes: encoded.exports.full,
        mime: "image/png",
        ext: "png",
        w: 1024,
        h: 1024,
      },
    ];
    if (encoded.exports.mask) {
      kinds.push({
        kind: "mask",
        bytes: encoded.exports.mask,
        mime: "image/png",
        ext: "png",
        w: 1024,
        h: 1024,
      });
    }
    if (encoded.exports.gif) {
      kinds.push({
        kind: "gif",
        bytes: encoded.exports.gif,
        mime: "image/gif",
        ext: "gif",
      });
    }
    if (encoded.exports.video) {
      kinds.push({
        kind: "video",
        bytes: encoded.exports.video,
        mime: "video/mp4",
        ext: "mp4",
      });
    }

    for (const item of kinds) {
      // Preserve previous thumbnail once before first overwrite in this encode pass
      if (item.kind === "thumbnail") {
        const existing = await prisma.mediaAsset.findUnique({
          where: { stickerId_kind: { stickerId, kind: "thumbnail" } },
        });
        if (
          existing?.compositionRevisionId &&
          existing.compositionRevisionId !== revision.id
        ) {
          await prisma.mediaAsset.deleteMany({
            where: { stickerId, kind: "prev_thumbnail" },
          });
          await prisma.mediaAsset.update({
            where: { id: existing.id },
            data: { kind: "prev_thumbnail" },
          });
        }
      }

      const up = await glass.objects.upload({
        prismId,
        file: item.bytes,
        title: `${sticker.slug}-${item.kind}`,
        filename: `${sticker.slug}-${item.kind}.${item.ext}`,
        fileExtension: item.ext,
      });
      await prisma.mediaAsset.upsert({
        where: { stickerId_kind: { stickerId, kind: item.kind } },
        create: {
          stickerId,
          compositionRevisionId: revision.id,
          kind: item.kind,
          mimeType: item.mime,
          fileExtension: item.ext,
          width: item.w ?? null,
          height: item.h ?? null,
          durationMs: encoded.meta.duration_ms || null,
          hasAudio: encoded.meta.has_audio,
          sizeBytes: BigInt(item.bytes.length),
          checksumSha256: sha256Hex(item.bytes),
          glassObjectId: up.object_id,
          glassPrismId: prismId,
          status: "ready",
        },
        update: {
          compositionRevisionId: revision.id,
          mimeType: item.mime,
          fileExtension: item.ext,
          width: item.w ?? null,
          height: item.h ?? null,
          durationMs: encoded.meta.duration_ms || null,
          hasAudio: encoded.meta.has_audio,
          sizeBytes: BigInt(item.bytes.length),
          checksumSha256: sha256Hex(item.bytes),
          glassObjectId: up.object_id,
          glassPrismId: prismId,
          status: "ready",
        },
      });
    }

    // Drop stale kinds not produced this encode (e.g. mask cleared)
    const keep = new Set(kinds.map((k) => k.kind));
    const stale = await prisma.mediaAsset.findMany({
      where: {
        stickerId,
        kind: { notIn: [...keep] },
        compositionRevisionId: revision.id,
      },
    });
    // Don't delete other revisions' media here — approve does that.
    void stale;
    void compositionNeedsAnimatedEncode;

    await prisma.sticker.update({
      where: { id: stickerId },
      data: { processingStatus: "ready", processingError: null },
    });
  } catch (err) {
    await fail(
      stickerId,
      err instanceof Error ? err.message : "Encode failed",
    );
  }
}

function collectAssetIds(doc: CompositionDocument): string[] {
  const ids = new Set<string>();
  for (const o of doc.objects) {
    if (o.type === "media") {
      ids.add(o.asset_id);
      if (o.mask_asset_id) ids.add(o.mask_asset_id);
    }
  }
  return [...ids];
}

function sha256Hex(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function fail(stickerId: bigint, message: string) {
  await prisma.sticker.update({
    where: { id: stickerId },
    data: {
      processingStatus: "failed",
      processingError: message.slice(0, 2000),
    },
  });
}

/** Delete derivative media (and GLASS objects) not tied to the current revision. */
export async function discardNonCurrentRevisionMedia(
  stickerId: bigint,
): Promise<void> {
  const composition = await prisma.composition.findUnique({
    where: { stickerId },
  });
  if (!composition?.currentRevisionId) return;

  const stale = await prisma.mediaAsset.findMany({
    where: {
      stickerId,
      OR: [
        { compositionRevisionId: null },
        { compositionRevisionId: { not: composition.currentRevisionId } },
        { kind: "prev_thumbnail" },
      ],
    },
  });
  if (stale.length === 0) return;

  const glass = getGlass();
  const current = await prisma.mediaAsset.findMany({
    where: {
      stickerId,
      compositionRevisionId: composition.currentRevisionId,
    },
    select: { glassObjectId: true },
  });
  const keepObjects = new Set(current.map((m) => m.glassObjectId));

  for (const asset of stale) {
    if (!keepObjects.has(asset.glassObjectId)) {
      try {
        await glass.prisms.unlinkObject(asset.glassPrismId, asset.glassObjectId);
      } catch {
        /* best-effort */
      }
      try {
        await glass.objects.delete(asset.glassObjectId);
      } catch {
        /* best-effort */
      }
    }
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
  }
}
