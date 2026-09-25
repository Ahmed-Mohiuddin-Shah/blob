import { createRequire } from "node:module";
import { CANVAS_SIZE, renderFrame, type CompositionDocument } from "blob-editor/core";
import { ensureNodeCanvas } from "@/lib/node-canvas";

const require = createRequire(import.meta.url);

type FrameResolver = (
  assetId: string,
) => CanvasImageSource | null | Promise<CanvasImageSource | null>;

/**
 * Encode a GIF from a composition (used when video encode didn't emit gif).
 * ponytail: host-side until blob-editor encodeComposition also emits gif for video.
 */
export async function encodeGifFromComposition(
  doc: CompositionDocument,
  frameResolver: FrameResolver,
): Promise<Uint8Array> {
  ensureNodeCanvas();
  let gifenc: {
    GIFEncoder: () => {
      writeFrame: (
        index: Uint8Array,
        w: number,
        h: number,
        opts: { palette: number[]; delay: number },
      ) => void;
      finish: () => void;
      bytes: () => Uint8Array;
    };
    quantize: (data: Uint8Array, maxColors: number) => number[];
    applyPalette: (data: Uint8Array, palette: number[]) => Uint8Array;
  };
  try {
    gifenc = require("gifenc");
  } catch {
    throw new Error("GIF encode requires optional dependency `gifenc`");
  }

  const fps = doc.fps || 15;
  const duration = Math.max(doc.duration_ms, 1);
  const frameCount = Math.max(1, Math.ceil((duration / 1000) * fps));
  const delayCs = Math.max(1, Math.round(100 / fps));
  const gif = gifenc.GIFEncoder();

  for (let i = 0; i < frameCount; i++) {
    const t = Math.min(duration, (i / fps) * 1000);
    const canvas = await renderFrame(doc, t, frameResolver);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d context unavailable");
    const id = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const data = new Uint8Array(id.data.buffer.slice(0));
    const palette = gifenc.quantize(data, 256);
    const index = gifenc.applyPalette(data, palette);
    gif.writeFrame(index, CANVAS_SIZE, CANVAS_SIZE, {
      palette,
      delay: delayCs,
    });
  }
  gif.finish();
  return gif.bytes();
}
