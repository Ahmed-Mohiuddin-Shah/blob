/**
 * Fast 2×3 storyboard (6 equal-interval frames) for GIF/video vision + CLIP.
 * Corner digits are sequence markers for prompts — not sticker content.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const FRAME_COUNT = 6;
const TILE = 170;
const COLS = 3;
const ROWS = 2;

export function isMotionMime(mime: string | null | undefined): boolean {
  const m = (mime ?? "").toLowerCase().split(";")[0]!.trim();
  return (
    m === "image/gif" ||
    m === "image/webp" ||
    m.startsWith("video/")
  );
}

async function resolveFfmpeg(): Promise<string> {
  try {
    const mod = await import("ffmpeg-static");
    const p = (mod as { default?: string }).default ?? (mod as unknown as string);
    if (p) return p;
  } catch {
    /* PATH */
  }
  return "ffmpeg";
}

function run(
  bin: string,
  args: string[],
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

async function probeDurationSec(path: string, ffmpeg: string): Promise<number> {
  const { stderr } = await run(ffmpeg, ["-i", path]);
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m) return 1;
  return Math.max(0.1, Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
}

/** Dump all GIF frames then pick 6 evenly — avoids sharp disposal/black-frame bugs. */
async function extractGifFramesFfmpeg(bytes: Buffer): Promise<Buffer[]> {
  const ffmpeg = await resolveFfmpeg();
  const dir = await mkdtemp(join(tmpdir(), "blob-sb-gif-"));
  const src = join(dir, "src.gif");
  try {
    await writeFile(src, bytes);
    const { code, stderr } = await run(ffmpeg, [
      "-y",
      "-i",
      src,
      "-vsync",
      "0",
      join(dir, "f%04d.png"),
    ]);
    if (code !== 0) {
      throw new Error(`ffmpeg gif extract failed: ${stderr.slice(0, 200)}`);
    }
    const files = (await readdir(dir))
      .filter((f) => /^f\d+\.png$/.test(f))
      .sort();
    if (!files.length) throw new Error("ffmpeg gif: no frames");
    const out: Buffer[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const idx = Math.min(
        files.length - 1,
        Math.floor(((i + 0.5) * files.length) / FRAME_COUNT),
      );
      out.push(await readFile(join(dir, files[idx]!)));
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readNumberedFrames(dir: string, re: RegExp): Promise<Buffer[]> {
  const files = (await readdir(dir)).filter((f) => re.test(f)).sort();
  if (!files.length) return [];
  const out: Buffer[] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const idx = Math.min(
      files.length - 1,
      Math.floor(((i + 0.5) * files.length) / FRAME_COUNT),
    );
    out.push(await readFile(join(dir, files[idx]!)));
  }
  return out;
}

/**
 * Video → 6 frames. Prefer fps sampling (no seek); seek is fragile on short/
 * oddly-muxed mp4s and often fails on frame 0.
 */
async function extractVideoFrames(
  bytes: Buffer,
  mime: string,
): Promise<Buffer[]> {
  const ffmpeg = await resolveFfmpeg();
  const dir = await mkdtemp(join(tmpdir(), "blob-sb-"));
  const ext = mime.includes("webm")
    ? "webm"
    : mime.includes("mov") || mime.includes("quicktime")
      ? "mov"
      : "mp4";
  const src = join(dir, `src.${ext}`);
  const pattern = join(dir, "f%04d.jpg");
  try {
    await writeFile(src, bytes);
    const dur = await probeDurationSec(src, ffmpeg);
    const fps = Math.max(0.1, FRAME_COUNT / Math.max(dur, 0.25));

    // 1) Even samples via fps filter (most reliable for search uploads).
    let { code, stderr } = await run(ffmpeg, [
      "-y",
      "-i",
      src,
      "-an",
      "-vf",
      `fps=${fps.toFixed(4)}`,
      "-frames:v",
      String(FRAME_COUNT),
      "-q:v",
      "3",
      pattern,
    ]);
    let frames = code === 0 ? await readNumberedFrames(dir, /^f\d+\.jpg$/) : [];

    // 2) Fallback: decode first N frames (ignores duration).
    if (frames.length < FRAME_COUNT) {
      ({ code, stderr } = await run(ffmpeg, [
        "-y",
        "-i",
        src,
        "-an",
        "-vsync",
        "0",
        "-frames:v",
        String(FRAME_COUNT),
        "-q:v",
        "3",
        pattern,
      ]));
      frames = code === 0 ? await readNumberedFrames(dir, /^f\d+\.jpg$/) : [];
    }

    // 3) Last resort: single still (poster), tiled 6× so search still works.
    if (!frames.length) {
      const one = join(dir, "still.jpg");
      ({ code, stderr } = await run(ffmpeg, [
        "-y",
        "-i",
        src,
        "-an",
        "-frames:v",
        "1",
        "-q:v",
        "3",
        one,
      ]));
      if (code !== 0) {
        throw new Error(
          `ffmpeg failed to extract video frames (${mime}): ${stderr.slice(-400)}`,
        );
      }
      const still = await readFile(one);
      frames = Array.from({ length: FRAME_COUNT }, () => still);
    }

    while (frames.length < FRAME_COUNT) {
      frames.push(frames[frames.length - 1]!);
    }
    return frames.slice(0, FRAME_COUNT);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Animated webp via sharp (ffmpeg often fails on animated webp).
 * With `{ page: n }`, sharp returns a strip from n→end — crop the top pageHeight.
 */
async function extractSharpAnimFrames(bytes: Buffer): Promise<Buffer[]> {
  let input = bytes;
  const meta0 = await sharp(bytes, { animated: true }).metadata();
  if (meta0.format === "webp" && (meta0.pages ?? 1) > 1) {
    input = await sharp(bytes, { animated: true }).gif().toBuffer();
  }
  const meta = await sharp(input, { animated: true }).metadata();
  const pages = meta.pages ?? 1;
  const width = meta.width ?? TILE;
  const frameH =
    meta.pageHeight ??
    (Math.floor((meta.height ?? TILE) / pages) || TILE);
  if (pages <= 1) {
    const one = await sharp(input)
      .resize(TILE, TILE, { fit: "cover" })
      .jpeg({ quality: 70 })
      .toBuffer();
    return Array.from({ length: FRAME_COUNT }, () => one);
  }
  const out: Buffer[] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const page = Math.min(
      pages - 1,
      Math.floor(((i + 0.5) * pages) / FRAME_COUNT),
    );
    out.push(
      await sharp(input, { animated: true, page })
        .extract({ left: 0, top: 0, width, height: frameH })
        .resize(TILE, TILE, { fit: "cover" })
        .jpeg({ quality: 70 })
        .toBuffer(),
    );
  }
  return out;
}

/**
 * Draw digit 1–9 without system fonts (Docker slim often has none).
 * 3×5 pixel grid scaled into the badge.
 */
function drawDigit(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  digit: number,
  ox: number,
  oy: number,
  cell = 3,
) {
  // 3×5 bitmaps for 1–9 (1 = filled)
  const glyphs: Record<number, number[]> = {
    1: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    2: [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
    3: [1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1],
    4: [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1],
    5: [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1],
    6: [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    8: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  };
  const g = glyphs[digit] ?? glyphs[1]!;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 15; i++) {
    if (!g[i]) continue;
    const col = i % 3;
    const row = Math.floor(i / 3);
    ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell);
  }
}

async function compositeStoryboard(frameBufs: Buffer[]): Promise<Buffer> {
  const w = COLS * TILE;
  const h = ROWS * TILE;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < FRAME_COUNT; i++) {
    const buf = frameBufs[i] ?? frameBufs[frameBufs.length - 1]!;
    const resized = await sharp(buf)
      .rotate()
      .resize(TILE, TILE, { fit: "cover" })
      .jpeg({ quality: 70 })
      .toBuffer();
    const img = await loadImage(resized);
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * TILE;
    const y = row * TILE;
    ctx.drawImage(img, x, y, TILE, TILE);
    // Frame border — helps the vision model see cell edges (not sticker content).
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    // Sequence badge — bitmap digits (no font dependency)
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x + 4, y + 4, 22, 26);
    drawDigit(ctx, i + 1, x + 7, y + 6, 3);
  }

  const png = canvas.toBuffer("image/png");
  return sharp(png)
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
}

/** Build storyboard JPEG from animated bytes. */
export async function buildStoryboardJpeg(
  bytes: Buffer,
  mime: string,
): Promise<Buffer> {
  if (bytes.byteLength === 0) throw new Error("Empty media for storyboard");
  const m = mime.toLowerCase();
  let frames: Buffer[];
  if (m.includes("gif")) {
    try {
      frames = await extractGifFramesFfmpeg(bytes);
    } catch (err) {
      console.warn("gif ffmpeg extract failed, sharp fallback:", err);
      frames = await extractSharpAnimFrames(bytes);
    }
  } else if (m.includes("webp")) {
    frames = await extractSharpAnimFrames(bytes);
  } else {
    frames = await extractVideoFrames(bytes, mime);
  }
  if (!frames.length) throw new Error("storyboard: no frames extracted");
  return compositeStoryboard(frames);
}

/** Base64 JPEG storyboard for Ollama / Meili media. */
export async function storyboardBase64(
  bytes: Buffer,
  mime: string,
): Promise<string> {
  const jpeg = await buildStoryboardJpeg(bytes, mime);
  return jpeg.toString("base64");
}
