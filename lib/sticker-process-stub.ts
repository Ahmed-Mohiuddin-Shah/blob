import sharp from "sharp";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import {
  SQUARE_SIZE,
  THUMB_SIZE,
  type FitMode,
} from "@/lib/stickers";

/**
 * ponytail: in-process stub instead of BullMQ/FFmpeg worker.
 * Static images get sharp square renditions; GIF/video reuse original as thumbnail.
 * Upgrade: separate worker + real gif/video pipeline when media volume needs isolation.
 */
export function enqueueStickerProcessing(stickerId: bigint): void {
  void processStickerStub(stickerId).catch((err) => {
    console.error("Stub process failed:", stickerId.toString(), err);
  });
}

async function processStickerStub(stickerId: bigint): Promise<void> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: { media: true },
  });
  if (!sticker) return;

  const original = sticker.media.find((m) => m.kind === "original");
  if (!original) {
    await fail(stickerId, "Missing original asset");
    return;
  }

  try {
    const glass = getGlass();
    const res = await glass.objects.download(original.glassObjectId);
    const bytes = Buffer.from(await res.arrayBuffer());
    const fitMode = sticker.fitMode as FitMode;
    const padBg = sticker.padBackground;

    if (original.mimeType.startsWith("image/") && original.mimeType !== "image/gif") {
      const square = await renderSquare(bytes, fitMode, padBg, SQUARE_SIZE);
      const thumb = await renderSquare(bytes, fitMode, padBg, THUMB_SIZE);

      const imageUp = await glass.objects.upload({
        prismId: original.glassPrismId,
        file: new Uint8Array(square),
        title: `${sticker.slug}-image`,
        filename: `${sticker.slug}.webp`,
      });
      const thumbUp = await glass.objects.upload({
        prismId: original.glassPrismId,
        file: new Uint8Array(thumb),
        title: `${sticker.slug}-thumb`,
        filename: `${sticker.slug}-thumb.webp`,
      });

      await prisma.mediaAsset.upsert({
        where: { stickerId_kind: { stickerId, kind: "image" } },
        create: {
          stickerId,
          kind: "image",
          mimeType: "image/webp",
          fileExtension: "webp",
          width: SQUARE_SIZE,
          height: SQUARE_SIZE,
          sizeBytes: BigInt(square.length),
          glassObjectId: imageUp.object_id,
          glassPrismId: original.glassPrismId,
          status: "ready",
        },
        update: {
          glassObjectId: imageUp.object_id,
          glassPrismId: original.glassPrismId,
          sizeBytes: BigInt(square.length),
          status: "ready",
        },
      });
      await prisma.mediaAsset.upsert({
        where: { stickerId_kind: { stickerId, kind: "thumbnail" } },
        create: {
          stickerId,
          kind: "thumbnail",
          mimeType: "image/webp",
          fileExtension: "webp",
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          sizeBytes: BigInt(thumb.length),
          glassObjectId: thumbUp.object_id,
          glassPrismId: original.glassPrismId,
          status: "ready",
        },
        update: {
          glassObjectId: thumbUp.object_id,
          glassPrismId: original.glassPrismId,
          sizeBytes: BigInt(thumb.length),
          status: "ready",
        },
      });
    } else {
      // GIF / video: point thumbnail at original until real worker exists
      await prisma.mediaAsset.upsert({
        where: { stickerId_kind: { stickerId, kind: "thumbnail" } },
        create: {
          stickerId,
          kind: "thumbnail",
          mimeType: original.mimeType,
          fileExtension: original.fileExtension,
          sizeBytes: original.sizeBytes,
          glassObjectId: original.glassObjectId,
          glassPrismId: original.glassPrismId,
          status: "ready",
        },
        update: {
          glassObjectId: original.glassObjectId,
          glassPrismId: original.glassPrismId,
          mimeType: original.mimeType,
          status: "ready",
        },
      });
      if (original.mimeType === "image/gif") {
        await prisma.mediaAsset.upsert({
          where: { stickerId_kind: { stickerId, kind: "gif" } },
          create: {
            stickerId,
            kind: "gif",
            mimeType: original.mimeType,
            fileExtension: "gif",
            sizeBytes: original.sizeBytes,
            glassObjectId: original.glassObjectId,
            glassPrismId: original.glassPrismId,
            status: "ready",
          },
          update: { status: "ready" },
        });
      } else if (original.mimeType === "video/mp4") {
        await prisma.mediaAsset.upsert({
          where: { stickerId_kind: { stickerId, kind: "video" } },
          create: {
            stickerId,
            kind: "video",
            mimeType: original.mimeType,
            fileExtension: "mp4",
            sizeBytes: original.sizeBytes,
            glassObjectId: original.glassObjectId,
            glassPrismId: original.glassPrismId,
            status: "ready",
          },
          update: { status: "ready" },
        });
      }
    }

    await prisma.mediaAsset.update({
      where: { id: original.id },
      data: { status: "ready" },
    });
    await prisma.sticker.update({
      where: { id: stickerId },
      data: { processingStatus: "ready", processingError: null },
    });
  } catch (err) {
    await fail(
      stickerId,
      err instanceof Error ? err.message : "Processing failed",
    );
  }
}

async function renderSquare(
  bytes: Buffer,
  fitMode: FitMode,
  padBackground: string,
  size: number,
): Promise<Buffer> {
  let pipeline = sharp(bytes).rotate();

  if (fitMode === "crop") {
    pipeline = pipeline.resize(size, size, { fit: "cover", position: "centre" });
  } else {
    const bg =
      padBackground === "transparent"
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : hexToRgba(padBackground);
    pipeline = pipeline.resize(size, size, {
      fit: "contain",
      background: bg,
    });
  }

  return pipeline.webp({ quality: 85 }).toBuffer();
}

function hexToRgba(hex: string): { r: number; g: number; b: number; alpha: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0, alpha: 0 };
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}

async function fail(stickerId: bigint, message: string) {
  await prisma.sticker.update({
    where: { id: stickerId },
    data: { processingStatus: "failed", processingError: message.slice(0, 2000) },
  });
}
