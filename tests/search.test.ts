import { describe, expect, it } from "vitest";
import { SEARCH_META_STATUS } from "../lib/search/constants";
import { MEILI_EMBEDDER, MEILI_INDEX } from "../lib/meili/indexes";
import { JOB_TYPE, JOB_TYPES } from "../lib/jobs/types";
import { isMeiliConfigured } from "../lib/meili/client";
import { printSearchDocId } from "../lib/search/documents";
import { pickSearchEnrichMedia } from "../lib/search/enrich";
import { visionImageBase64 } from "../lib/search/vision-image";
import {
  parseVisionEnrichResult,
  structureEnrichPrompt,
  VISION_DESCRIBE_PROMPT,
} from "../lib/search/vision-parse";
import { MEDIA_KIND } from "../lib/stickers";

describe("search constants", () => {
  it("exposes search meta statuses", () => {
    expect(SEARCH_META_STATUS.pendingSearchMeta).toBe("pending_search_meta");
    expect(SEARCH_META_STATUS.approved).toBe("approved");
  });

  it("registers search_enrich job type", () => {
    expect(JOB_TYPE.searchEnrich).toBe("search_enrich");
    expect(JOB_TYPES).toContain("search_enrich");
  });

  it("names meili indexes and embedders", () => {
    expect(MEILI_INDEX.stickers).toBe("stickers");
    expect(MEILI_EMBEDDER.image).toBe("image");
  });

  it("treats empty MEILI_HOST as unconfigured", () => {
    const prev = process.env.MEILI_HOST;
    delete process.env.MEILI_HOST;
    expect(isMeiliConfigured()).toBe(false);
    if (prev !== undefined) process.env.MEILI_HOST = prev;
  });

  it("uses hyphen print doc ids (Meili-safe)", () => {
    expect(printSearchDocId("sheet", BigInt(7))).toBe("sheet-7");
    expect(printSearchDocId("pack", "3")).toBe("pack-3");
  });

  it("uses plain vision prompt and agent structure prompt", () => {
    expect(VISION_DESCRIBE_PROMPT).toBe("Describe this image for search:");
    expect(structureEnrichPrompt("a blackboard on a wall")).toContain(
      "a blackboard on a wall",
    );
    expect(structureEnrichPrompt("x")).toContain("ONLY JSON");
  });

  it("rejects empty or schema-echo agent captions", () => {
    expect(() => parseVisionEnrichResult("")).toThrow();
    expect(() =>
      parseVisionEnrichResult(
        "The image shows a blackboard on a concrete wall.",
      ),
    ).toThrow(/JSON parse failed/);
    expect(() =>
      parseVisionEnrichResult(
        '{"caption":"one sentence visual description","scenario":"","tags":[]}',
      ),
    ).toThrow(/empty or placeholder/);
    const ok = parseVisionEnrichResult(
      '{"caption":"a blue cat under rain","scenario":"weather chat","tags":["CAT","RAIN"]}',
    );
    expect(ok.aiCaption).toBe("a blue cat under rain");
    expect(ok.aiVisualTags).toEqual(["CAT", "RAIN"]);
  });

  it("picks thumbnail over gif for enrich preview", () => {
    expect(
      pickSearchEnrichMedia([
        { kind: MEDIA_KIND.gif },
        { kind: MEDIA_KIND.thumbnail },
      ])?.kind,
    ).toBe(MEDIA_KIND.thumbnail);
    expect(pickSearchEnrichMedia([{ kind: MEDIA_KIND.gif }])).toBeNull();
  });

  it("resizes vision input to jpeg within max edge", async () => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .png()
      .toBuffer();
    const b64 = await visionImageBase64(png);
    const meta = await sharp(Buffer.from(b64, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
  });
});
