/**
 * ponytail: in-process print encode instead of BullMQ.
 * Uses blob-editor/encode + public prism. Upgrade: worker when volume needs isolation.
 */

import {
  combinePdfs,
  combinePngsGrid,
  encodePrint,
} from "blob-editor/encode";
import { validatePrintDocument } from "blob-editor/print";
import { getGlass, getPublicPrismId } from "@/lib/glass";
import { ensureNodeCanvas } from "@/lib/node-canvas";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import {
  appendProcessingLog,
  PROCESSING_SUBJECT,
} from "@/lib/processing-log";
import { MEDIA_ASSET_STATUS, MEDIA_KIND } from "@/lib/stickers";

/** Fire-and-forget (pack wait / detail recovery). Prefer `runSheetEncode` on create. */
export function enqueueSheetEncode(sheetId: bigint): void {
  void processSheet(sheetId).catch((err) => {
    console.error("Sheet encode failed:", sheetId.toString(), err);
  });
}

export function enqueuePackEncode(packId: bigint): void {
  void processPack(packId).catch((err) => {
    console.error("Pack encode failed:", packId.toString(), err);
  });
}

/** Awaitable encode — use on create so Next doesn't drop the job mid-request. */
export async function runSheetEncode(sheetId: bigint): Promise<void> {
  await processSheet(sheetId);
}

export async function runPackEncode(packId: bigint): Promise<void> {
  await processPack(packId);
}

async function toPngBytes(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (mime === "image/png") return bytes;
  // pdf-lib embedPng needs PNG; stickers may be webp/jpeg (or gif stills)
  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp(Buffer.from(bytes)).png().toBuffer());
}

async function processSheet(sheetId: bigint): Promise<void> {
  const sheet = await prisma.stickerSheet.findUnique({
    where: { id: sheetId },
    include: {
      stickers: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!sheet) return;
  if (sheet.status === PRINT_STATUS.ready) return;

  try {
    ensureNodeCanvas();
    const doc = validatePrintDocument(sheet.printDocumentJson);
    const glass = getGlass();
    const stickerIds = sheet.stickers.map((s) => s.stickerId);

    const media = await prisma.mediaAsset.findMany({
      where: {
        stickerId: { in: stickerIds },
        kind: MEDIA_KIND.image,
        status: MEDIA_ASSET_STATUS.ready,
      },
    });
    const bySticker = new Map(media.map((m) => [m.stickerId.toString(), m]));

    const bytesResolver = async (assetId: string) => {
      const m = bySticker.get(assetId);
      if (!m) return null;
      if (!m.mimeType.startsWith("image/")) return null;
      const res = await glass.objects.download(m.glassObjectId);
      const raw = new Uint8Array(await res.arrayBuffer());
      try {
        return await toPngBytes(raw, m.mimeType);
      } catch {
        return null;
      }
    };

    const encoded = await encodePrint(doc, bytesResolver, {
      dpi: 150,
      formats: ["png", "pdf"],
    });

    const png = encoded.exports.png;
    const pdf = encoded.exports.pdf;
    if (!png || !pdf) {
      await failSheet(sheetId, "Encode missing png or pdf");
      return;
    }

    const prismId = await getPublicPrismId();
    const pngUp = await glass.objects.upload({
      prismId,
      file: png,
      title: `${sheet.slug}-sheet`,
      filename: `${sheet.slug}.png`,
      fileExtension: "png",
    });
    const pdfUp = await glass.objects.upload({
      prismId,
      file: pdf,
      title: `${sheet.slug}-sheet-pdf`,
      filename: `${sheet.slug}.pdf`,
      fileExtension: "pdf",
    });

    await prisma.stickerSheet.update({
      where: { id: sheetId },
      data: {
        status: PRINT_STATUS.ready,
        errorMessage: null,
        pngGlassObjectId: pngUp.object_id,
        pngGlassPrismId: prismId,
        pdfGlassObjectId: pdfUp.object_id,
        pdfGlassPrismId: prismId,
        pngSizeBytes: BigInt(png.length),
        pdfSizeBytes: BigInt(pdf.length),
      },
    });

    // Re-kick packs waiting on this sheet
    const waiting = await prisma.packSheet.findMany({
      where: { sheetId },
      select: { packId: true },
    });
    for (const { packId } of waiting) {
      enqueuePackEncode(packId);
    }
  } catch (err) {
    await failSheet(
      sheetId,
      err instanceof Error ? err.message : "Sheet encode failed",
    );
  }
}

async function processPack(packId: bigint): Promise<void> {
  const pack = await prisma.stickerPack.findUnique({
    where: { id: packId },
    include: {
      sheets: {
        orderBy: { sortOrder: "asc" },
        include: { sheet: true },
      },
    },
  });
  if (!pack) return;

  try {
    const sheets = pack.sheets.map((ps) => ps.sheet);
    if (sheets.some((s) => s.status === PRINT_STATUS.failed)) {
      await failPack(packId, "A member sheet failed to encode");
      return;
    }
    if (sheets.some((s) => s.status !== PRINT_STATUS.ready)) {
      // Still waiting — stay pending
      return;
    }
    if (
      sheets.some(
        (s) => !s.pngGlassObjectId || !s.pdfGlassObjectId,
      )
    ) {
      await failPack(packId, "Member sheet missing glass objects");
      return;
    }

    ensureNodeCanvas();
    const glass = getGlass();
    const pdfs: Uint8Array[] = [];
    const pngs: Uint8Array[] = [];
    for (const s of sheets) {
      const pdfRes = await glass.objects.download(s.pdfGlassObjectId!);
      pdfs.push(new Uint8Array(await pdfRes.arrayBuffer()));
      const pngRes = await glass.objects.download(s.pngGlassObjectId!);
      pngs.push(new Uint8Array(await pngRes.arrayBuffer()));
    }

    const packPdf = await combinePdfs(pdfs);
    const packPng = await combinePngsGrid(pngs, {
      gapPx: 8,
      background: "#FFFFFF",
    });

    const prismId = await getPublicPrismId();
    const pngUp = await glass.objects.upload({
      prismId,
      file: packPng,
      title: `${pack.slug}-pack`,
      filename: `${pack.slug}.png`,
      fileExtension: "png",
    });
    const pdfUp = await glass.objects.upload({
      prismId,
      file: packPdf,
      title: `${pack.slug}-pack-pdf`,
      filename: `${pack.slug}.pdf`,
      fileExtension: "pdf",
    });

    await prisma.stickerPack.update({
      where: { id: packId },
      data: {
        status: PRINT_STATUS.ready,
        errorMessage: null,
        pngGlassObjectId: pngUp.object_id,
        pngGlassPrismId: prismId,
        pdfGlassObjectId: pdfUp.object_id,
        pdfGlassPrismId: prismId,
        pngSizeBytes: BigInt(packPng.length),
        pdfSizeBytes: BigInt(packPdf.length),
      },
    });
  } catch (err) {
    await failPack(
      packId,
      err instanceof Error ? err.message : "Pack encode failed",
    );
  }
}

async function failSheet(sheetId: bigint, message: string) {
  const sheet = await prisma.stickerSheet.update({
    where: { id: sheetId },
    data: {
      status: PRINT_STATUS.failed,
      errorMessage: message.slice(0, 2000),
    },
    select: { name: true },
  });
  await appendProcessingLog({
    subjectType: PROCESSING_SUBJECT.stickerSheet,
    subjectId: sheetId,
    subjectTitle: sheet.name,
    message,
  });
}

async function failPack(packId: bigint, message: string) {
  const pack = await prisma.stickerPack.update({
    where: { id: packId },
    data: {
      status: PRINT_STATUS.failed,
      errorMessage: message.slice(0, 2000),
    },
    select: { name: true },
  });
  await appendProcessingLog({
    subjectType: PROCESSING_SUBJECT.stickerPack,
    subjectId: packId,
    subjectTitle: pack.name,
    message,
  });
}
