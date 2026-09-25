/**
 * Node canvas polyfill for blob-editor encode (needs OffscreenCanvas + Image).
 * Call once before encodeComposition / renderFrame in workers.
 */
import { createCanvas, Image, DOMMatrix, Path2D } from "@napi-rs/canvas";

let installed = false;

export function ensureNodeCanvas(): void {
  if (installed) return;
  installed = true;

  // @ts-expect-error Node has no OffscreenCanvas; encode uses it when present
  globalThis.OffscreenCanvas = function OffscreenCanvas(w: number, h: number) {
    const c = createCanvas(w, h);
    // blob-editor encode calls convertToBlob on OffscreenCanvas
    (c as unknown as { convertToBlob: (opts?: { type?: string }) => Promise<Blob> }).convertToBlob =
      async ({ type } = {}) => {
        const buf = await c.encode("png");
        return new Blob([Uint8Array.from(buf)], { type: type ?? "image/png" });
      };
    return c;
  };

  if (typeof globalThis.Image === "undefined") {
    // @ts-expect-error Image polyfill for decode paths
    globalThis.Image = Image;
  }
  if (typeof globalThis.DOMMatrix === "undefined") {
    // @ts-expect-error DOMMatrix for transforms
    globalThis.DOMMatrix = DOMMatrix;
  }
  if (typeof globalThis.Path2D === "undefined") {
    // @ts-expect-error Path2D polyfill
    globalThis.Path2D = Path2D;
  }
}
