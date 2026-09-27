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
