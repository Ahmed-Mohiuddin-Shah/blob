import { describe, expect, it } from "vitest";
import { isPublicHttpUrl, pickSiteIcon } from "@/lib/site-icon";

describe("isPublicHttpUrl", () => {
  it("allows public https", () => {
    expect(isPublicHttpUrl("https://offscriptstore.com")).toBe(true);
  });
  it("blocks private / loopback", () => {
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://localhost/x")).toBe(false);
  });
});

describe("pickSiteIcon", () => {
  it("prefers apple-touch then icon over og:image", () => {
    const html = `
      <meta property="og:image" content="https://example.com/og.png">
      <link rel="icon" type="image/png" href="//example.com/cdn/icon.png?w=32">
      <link rel="apple-touch-icon" href="/apple.png">
    `;
    expect(pickSiteIcon(html, "https://example.com/shop")).toBe(
      "https://example.com/apple.png",
    );
  });

  it("resolves protocol-relative icon hrefs", () => {
    const html = `<link rel="icon" href="//offscriptstore.com/cdn/shop/files/cat_patch.png">`;
    expect(pickSiteIcon(html, "https://offscriptstore.com/")).toBe(
      "https://offscriptstore.com/cdn/shop/files/cat_patch.png",
    );
  });
});
