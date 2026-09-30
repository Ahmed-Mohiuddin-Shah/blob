/**
 * Fast 2×3 storyboard (6 equal-interval frames) for GIF/video vision + CLIP.
 * Corner digits are sequence markers for prompts — not sticker content.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function extractVideoFrames(
  bytes: Buffer,
  mime: string,
): Promise<Buffer[]> {
  const ffmpeg = await resolveFfmpeg();
  const dir = await mkdtemp(join(tmpdir(), "blob-sb-"));
  const ext = mime.includes("webm")
    ? "webm"
    : mime.includes("gif")
      ? "gif"
      : mime.includes("webp")
        ? "webp"
        : "mp4";
  const src = join(dir, `src.${ext}`);
  try {
    await writeFile(src, bytes);
    const dur = await probeDurationSec(src, ffmpeg);
    const out: Buffer[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const t = (dur * (i + 0.5)) / FRAME_COUNT;
      const png = join(dir, `f${i}.jpg`);
      const { code } = await run(ffmpeg, [
        "-y",
        "-ss",
        String(t.toFixed(3)),
        "-i",
        src,
        "-frames:v",
        "1",
        "-q:v",
        "5",
        png,
      ]);
      if (code !== 0) {
        await run(ffmpeg, [
          "-y",
          "-i",
          src,
          "-ss",
          String(t.toFixed(3)),
          "-frames:v",
          "1",
          "-q:v",
          "5",
          png,
        ]);
      }
      try {
        out.push(await readFile(png));
      } catch {
        throw new Error(`ffmpeg failed to extract frame ${i} (${mime})`);
      }
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Animated gif/webp via sharp.
 * With `{ page: n }`, sharp returns a strip from n→end — crop the top pageHeight.
 */
async function extractSharpAnimFrames(bytes: Buffer): Promise<Buffer[]> {
  // Normalize webp→gif when needed so page seeking is reliable.
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
        .jpeg({ quality: 70 })
        .toBuffer(),
    );
  }
  return out;
}

async function compositeStoryboard(frameBufs: Buffer[]): Promise<Buffer> {
  const w = COLS * TILE;
  const h = ROWS * TILE;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "bold 22px sans-serif";

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
    // Sequence badge
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x + 4, y + 4, 28, 28);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + 10, y + 25);
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
  if (m.includes("gif") || m.includes("webp")) {
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
