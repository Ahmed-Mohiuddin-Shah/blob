import { createHash } from "crypto";
import { loadImage } from "@napi-rs/canvas";
import {
  combinePdfs,
  combinePngsGrid,
  compositionNeedsAnimatedEncode,
  encodeComposition,
  encodePrint,
  type AssetBytesResolver,
} from "blob-editor/encode";
import { validateDocument, type CompositionDocument } from "blob-editor/core";
import { validatePrintDocument } from "blob-editor/print";
import { Glass } from "glass-ts";
import type {
  CompositionJobPayload,
  JobPayload,
  PackJobPayload,
  SearchEnrichJobPayload,
  SheetJobPayload,
} from "../lib/jobs/payload-types";
import { JOB_TYPE } from "../lib/jobs/types";
import { ensureNodeCanvas } from "../lib/node-canvas";
import { visionImageBase64 } from "../lib/search/vision-image";
import {
  isSparseEnrich,
  parseVisionEnrichResult,
  structureEnrichFromImagePrompt,
  structureEnrichPrompt,
  visionDescribePrompt,
} from "../lib/search/vision-parse";
import { encodeWhatsAppOg } from "../lib/whatsapp-og-encode";
import {
  MAX_GIF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_OG_BYTES,
  MAX_VIDEO_BYTES,
  MEDIA_KIND,
  mimeToExt,
} from "./media";

function sha256Hex(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

function assertBudget(label: string, bytes: Uint8Array, max: number): void {
  if (bytes.byteLength > max) {
    throw new Error(
      `${label} derivative ${bytes.byteLength} bytes exceeds budget ${max}`,
    );
  }
}

function glassClient(baseUrl: string, apiKey: string): Glass {
  return new Glass({ baseUrl, apiKey });
}

async function toPngBytes(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (mime === "image/png") return bytes;
  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp(Buffer.from(bytes)).png().toBuffer());
}

export async function runWorkerJob(
  payload: JobPayload,
  glassUrl: string,
  glassKey: string,
): Promise<unknown> {
  if (payload.kind === JOB_TYPE.searchEnrich) {
    return runSearchEnrich(payload, glassUrl, glassKey);
  }

  ensureNodeCanvas();
  const glass = glassClient(glassUrl, glassKey);

  if (payload.kind === JOB_TYPE.compositionEncode) {
    return runComposition(payload, glass);
  }
  if (payload.kind === JOB_TYPE.sheetEncode) {
    return runSheet(payload, glass);
  }
  return runPack(payload, glass);
}

async function ollamaChatWorker(opts: {
  base: string;
  headers: Record<string, string>;
  model: string;
  content: string;
  images?: string[];
}): Promise<string> {
  const chatRes = await fetch(`${opts.base}/api/chat`, {
    method: "POST",
    headers: opts.headers,
    body: JSON.stringify({
      model: opts.model,
      stream: false,
      messages: [
        {
          role: "user",
          content: opts.content,
          ...(opts.images?.length ? { images: opts.images } : {}),
        },
      ],
    }),
  });
  if (!chatRes.ok) {
    throw new Error(`Ollama chat ${chatRes.status}: ${await chatRes.text()}`);
  }
  const data = (await chatRes.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}

async function runSearchEnrich(
  payload: SearchEnrichJobPayload,
  glassUrl: string,
  glassKey: string,
): Promise<{
  aiCaption: string;
  aiScenario: string;
  aiVisualTags: string[];
}> {
  const ollamaBase = (process.env.OLLAMA_BASE_URL || "").replace(/\/$/, "");
  if (!ollamaBase) throw new Error("OLLAMA_BASE_URL is not set on worker");
  const visionModel = process.env.OLLAMA_VISION_MODEL?.trim() || "moondream";
  const agentModel = process.env.OLLAMA_AGENT_MODEL?.trim() || "qwen2.5:3b";

  const glass = glassClient(glassUrl, glassKey);
  const res = await glass.objects.download(payload.glassObjectId);
  const b64 = await visionImageBase64(
    Buffer.from(await res.arrayBuffer()),
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const chatOnce = () =>
    ollamaChatWorker({
      base: ollamaBase,
      headers,
      model: visionModel,
      content: visionDescribePrompt(visionModel),
      images: [b64],
    });
  let prose = await chatOnce();
  if (!prose) prose = await chatOnce();
  if (!prose) {
    throw new Error(
      `Vision description empty (${visionModel}) — check Ollama vision model`,
    );
  }

  const tryParse = (raw: string) => {
    try {
      return parseVisionEnrichResult(raw);
    } catch {
      return null;
    }
  };

  let result = tryParse(
    await ollamaChatWorker({
      base: ollamaBase,
      headers,
      model: agentModel,
      content: structureEnrichPrompt(prose),
    }),
  );
  if (!result || isSparseEnrich(result)) {
    result = tryParse(
      await ollamaChatWorker({
        base: ollamaBase,
        headers,
        model: agentModel,
        content: `${structureEnrichPrompt(prose)}\n\nYour previous reply was missing scenario or tags. Fill ALL three fields.`,
      }),
    );
  }
  if (!result || isSparseEnrich(result)) {
    result = tryParse(
      await ollamaChatWorker({
        base: ollamaBase,
        headers,
        model: visionModel,
        content: structureEnrichFromImagePrompt(visionModel),
        images: [b64],
      }),
    );
  }
  if (result && !isSparseEnrich(result)) return result;
  if (result) {
    if (!result.aiScenario.trim()) {
      result.aiScenario = "Reaction sticker in chat";
    }
    if (result.aiVisualTags.length < 3) {
      result.aiVisualTags = [
        ...result.aiVisualTags,
        "STICKER",
        "MEME",
        "REACTION",
      ].filter((t, i, a) => a.indexOf(t) === i);
    }
    return result;
  }
  return {
    aiCaption: prose.slice(0, 1000),
    aiScenario: "Reaction sticker in chat",
    aiVisualTags: ["STICKER", "MEME", "REACTION"],
  };
}

async function runComposition(
  payload: CompositionJobPayload,
  glass: Glass,
): Promise<unknown> {
  const durationOpts =
    payload.maxDurationMs != null
      ? { maxDurationMs: payload.maxDurationMs }
      : undefined;

  let doc: CompositionDocument;
  try {
    doc = validateDocument(payload.documentJson, durationOpts);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Invalid document",
    );
  }

  const needsAnimated = compositionNeedsAnimatedEncode(doc);
  // Remote worker always encodes when prism available; skip only if no prism and static
  // (client stills path is handled by control-plane local encode / skipped payload).
  if (!payload.prismId && !needsAnimated) {
    return { skipped: true };
  }
  if (!payload.prismId) {
    throw new Error("No GLASS prism for uploads");
  }

  const images = new Map<string, Awaited<ReturnType<typeof loadImage>>>();
  const bytesCache = new Map<string, Uint8Array>();

  for (const a of payload.assets) {
    const res = await glass.objects.download(a.glassObjectId);
    const bytes = new Uint8Array(await res.arrayBuffer());
    bytesCache.set(a.id, bytes);
    if (a.mimeType.startsWith("image/") && a.mimeType !== "image/gif") {
      images.set(a.id, await loadImage(Buffer.from(bytes)));
    } else if (a.mimeType === "image/gif") {
      try {
        images.set(a.id, await loadImage(Buffer.from(bytes)));
      } catch {
        /* animated may use bytes */
      }
    }
  }

  const frameResolver = async (assetId: string) =>
    (images.get(assetId) as unknown as CanvasImageSource) ?? null;
  const bytesResolver: AssetBytesResolver = async (assetId) =>
    bytesCache.get(assetId) ?? null;

  const encoded = await encodeComposition(
    doc,
    frameResolver,
    bytesResolver,
    durationOpts,
  );

  const mimes = encoded.meta.mimeTypes;
  assertBudget("image", encoded.exports.full, MAX_IMAGE_BYTES);
  assertBudget("chat", encoded.exports.chat, MAX_IMAGE_BYTES);
  assertBudget("thumbnail", encoded.exports.thumbnail, MAX_IMAGE_BYTES);
  if (encoded.exports.gif) {
    assertBudget("gif", encoded.exports.gif, MAX_GIF_BYTES);
  }
  if (encoded.exports.video) {
    assertBudget("video", encoded.exports.video, MAX_VIDEO_BYTES);
  }

  const kinds: {
    kind: string;
    bytes: Uint8Array;
    mime: string;
    ext: string;
    w?: number;
    h?: number;
  }[] = [
    {
      kind: MEDIA_KIND.chat,
      bytes: encoded.exports.chat,
      mime: mimes.chat,
      ext: mimeToExt(mimes.chat),
      w: 128,
      h: 128,
    },
    {
      kind: MEDIA_KIND.thumbnail,
      bytes: encoded.exports.thumbnail,
      mime: mimes.thumbnail,
      ext: mimeToExt(mimes.thumbnail),
      w: 256,
      h: 256,
    },
    {
      kind: MEDIA_KIND.image,
      bytes: encoded.exports.full,
      mime: mimes.full,
      ext: mimeToExt(mimes.full),
      w: 1024,
      h: 1024,
    },
  ];
  if (encoded.exports.mask) {
    kinds.push({
      kind: MEDIA_KIND.mask,
      bytes: encoded.exports.mask,
      mime: mimes.mask ?? "image/png",
      ext: mimeToExt(mimes.mask ?? "image/png"),
      w: 1024,
      h: 1024,
    });
  }
  if (encoded.exports.gif) {
    kinds.push({
      kind: MEDIA_KIND.gif,
      bytes: encoded.exports.gif,
      mime: mimes.gif ?? "image/gif",
      ext: "gif",
    });
  }
  if (encoded.exports.video) {
    kinds.push({
      kind: MEDIA_KIND.video,
      bytes: encoded.exports.video,
      mime: mimes.video ?? "video/mp4",
      ext: "mp4",
    });
  }

  const og = await encodeWhatsAppOg(encoded.exports.full);
  assertBudget("og", og.bytes, MAX_OG_BYTES);
  kinds.push({
    kind: MEDIA_KIND.og,
    bytes: og.bytes,
    mime: og.mime,
    ext: og.ext,
    w: og.width,
    h: og.height,
  });

  const derivatives = [];
  for (const item of kinds) {
    const up = await glass.objects.upload({
      prismId: payload.prismId,
      file: item.bytes,
      title: `${payload.slug}-${item.kind}`,
      filename: `${payload.slug}-${item.kind}.${item.ext}`,
      fileExtension: item.ext,
    });
    derivatives.push({
      kind: item.kind,
      glassObjectId: up.object_id,
      glassPrismId: payload.prismId,
      mimeType: item.mime,
      fileExtension: item.ext,
      width: item.w ?? null,
      height: item.h ?? null,
      sizeBytes: item.bytes.length,
      checksumSha256: sha256Hex(item.bytes),
      durationMs: encoded.meta.duration_ms || null,
      hasAudio: encoded.meta.has_audio,
    });
  }

  return {
    revisionId: payload.revisionId,
    derivatives,
  };
}

async function runSheet(
  payload: SheetJobPayload,
  glass: Glass,
): Promise<unknown> {
  const doc = validatePrintDocument(payload.printDocumentJson);
  const bySticker = new Map(
    payload.stickers.map((s) => [s.stickerId, s]),
  );

  const bytesResolver = async (assetId: string) => {
    const m = bySticker.get(assetId);
    if (!m || !m.mimeType.startsWith("image/")) return null;
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
  if (!png || !pdf) throw new Error("Encode missing png or pdf");

  const pngUp = await glass.objects.upload({
    prismId: payload.prismId,
    file: png,
    title: `${payload.slug}-sheet`,
    filename: `${payload.slug}.png`,
    fileExtension: "png",
  });
  const pdfUp = await glass.objects.upload({
    prismId: payload.prismId,
    file: pdf,
    title: `${payload.slug}-sheet-pdf`,
    filename: `${payload.slug}.pdf`,
    fileExtension: "pdf",
  });

  return {
    pngGlassObjectId: pngUp.object_id,
    pdfGlassObjectId: pdfUp.object_id,
    pngGlassPrismId: payload.prismId,
    pdfGlassPrismId: payload.prismId,
    pngSizeBytes: png.length,
    pdfSizeBytes: pdf.length,
  };
}

async function runPack(
  payload: PackJobPayload,
  glass: Glass,
): Promise<unknown> {
  if (payload.sheets.some((s) => s.status === "failed")) {
    throw new Error("A member sheet failed to encode");
  }
  if (payload.sheets.some((s) => s.status !== "ready")) {
    return { deferred: true };
  }
  if (
    payload.sheets.some((s) => !s.pngGlassObjectId || !s.pdfGlassObjectId)
  ) {
    throw new Error("Member sheet missing glass objects");
  }

  const pdfs: Uint8Array[] = [];
  const pngs: Uint8Array[] = [];
  for (const s of payload.sheets) {
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

  const pngUp = await glass.objects.upload({
    prismId: payload.prismId,
    file: packPng,
    title: `${payload.slug}-pack`,
    filename: `${payload.slug}.png`,
    fileExtension: "png",
  });
  const pdfUp = await glass.objects.upload({
    prismId: payload.prismId,
    file: packPdf,
    title: `${payload.slug}-pack-pdf`,
    filename: `${payload.slug}.pdf`,
    fileExtension: "pdf",
  });

  return {
    pngGlassObjectId: pngUp.object_id,
    pdfGlassObjectId: pdfUp.object_id,
    pngGlassPrismId: payload.prismId,
    pdfGlassPrismId: payload.prismId,
    pngSizeBytes: packPng.length,
    pdfSizeBytes: packPdf.length,
  };
}
