import { describe, expect, it } from "vitest";
import { isHttpUrl } from "@/lib/attribution";
import {
  normalizeBlobberName,
  parseCmsPayload,
} from "@/lib/blobbers";

describe("normalizeBlobberName", () => {
  it("trims and caps length", () => {
    expect(normalizeBlobberName("  Ada  ")).toBe("Ada");
    expect(normalizeBlobberName("x".repeat(250)).length).toBe(200);
  });
});

describe("parseCmsPayload", () => {
  it("requires display name", () => {
    expect(parseCmsPayload({})).toEqual({ error: "Display name required" });
  });

  it("accepts social links with http urls", () => {
    const parsed = parseCmsPayload({
      displayName: "Ada",
      description: "hi",
      showStickers: true,
      showCollections: false,
      showStickerSheets: true,
      socialLinks: [
        {
          linkType: "youtube",
          handle: "ada",
          url: "https://youtube.com/@ada",
        },
      ],
    });
    expect(parsed).toMatchObject({
      displayName: "Ada",
      showCollections: false,
      socialLinks: [{ linkType: "youtube", handle: "ada" }],
    });
  });

  it("rejects bad social url", () => {
    expect(
      parseCmsPayload({
        displayName: "Ada",
        socialLinks: [{ linkType: "other", handle: "x", url: "ftp://nope" }],
      }),
    ).toEqual({ error: "Each social link needs a handle and http(s) URL" });
  });
});

describe("isHttpUrl", () => {
  it("allows http(s) only", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("ftp://x")).toBe(false);
  });
});

describe("prepareBlobberImage", () => {
  it("cover-crops and stays under size caps", async () => {
    const { default: sharp } = await import("sharp");
    const { prepareBlobberImage } = await import("@/lib/prepare-blobber-image");
    const { BLOBBER_IMAGE } = await import("@/lib/blobber-image-spec");

    const raw = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 240, g: 20, b: 160 },
      },
    })
      .png()
      .toBuffer();

    const banner = await prepareBlobberImage(raw, "banner");
    expect(banner.mime).toBe("image/jpeg");
    expect(banner.bytes.length).toBeLessThanOrEqual(BLOBBER_IMAGE.banner.maxBytes);
    const bMeta = await sharp(Buffer.from(banner.bytes)).metadata();
    expect(bMeta.width).toBe(BLOBBER_IMAGE.banner.width);
    expect(bMeta.height).toBe(BLOBBER_IMAGE.banner.height);

    const avatar = await prepareBlobberImage(raw, "avatar");
    expect(avatar.bytes.length).toBeLessThanOrEqual(BLOBBER_IMAGE.avatar.maxBytes);
    const aMeta = await sharp(Buffer.from(avatar.bytes)).metadata();
    expect(aMeta.width).toBe(BLOBBER_IMAGE.avatar.width);
    expect(aMeta.height).toBe(BLOBBER_IMAGE.avatar.height);
  });
});
