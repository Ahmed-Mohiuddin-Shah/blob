import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderSquare } from "@/lib/sticker-process-stub";

describe("renderSquare", () => {
  it("produces decodable square PNG from grayscale JPEG without top chroma banding", async () => {
    const jpeg = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 180, g: 180, b: 180 },
      },
    })
      .greyscale()
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    const out = await renderSquare(jpeg, "pad", "transparent", 64);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);

    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    let topChroma = 0;
    let n = 0;
    for (let y = 0; y < Math.floor(info.height / 2); y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        topChroma +=
          Math.abs(data[i]! - data[i + 1]!) + Math.abs(data[i + 1]! - data[i + 2]!);
        n++;
      }
    }
    expect(topChroma / n).toBeLessThan(0.01);
  });

  it("crop mode yields exact size", async () => {
    const png = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    })
      .png()
      .toBuffer();

    const out = await renderSquare(png, "crop", "transparent", 32);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });
});
