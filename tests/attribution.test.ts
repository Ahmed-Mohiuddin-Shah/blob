import { describe, expect, it } from "vitest";
import { isHttpUrl, parseAttributionInput } from "@/lib/attribution";

describe("parseAttributionInput", () => {
  it("clears fields when No", () => {
    expect(
      parseAttributionInput({
        hasAttribution: "no",
        authorName: "x",
        sourceUrl: "https://example.com",
      }),
    ).toEqual({ authorName: null, sourceUrl: null });
  });

  it("requires label and http(s) URL when Yes", () => {
    expect(
      parseAttributionInput({ hasAttribution: "yes", authorName: "", sourceUrl: "" }),
    ).toEqual({ error: "Attribution label required" });
    expect(
      parseAttributionInput({
        hasAttribution: "yes",
        authorName: "Ada",
        sourceUrl: "ftp://nope",
      }),
    ).toEqual({ error: "Source link must be an http(s) URL" });
    expect(
      parseAttributionInput({
        hasAttribution: "yes",
        authorName: "Ada",
        sourceUrl: "https://example.com/a",
      }),
    ).toEqual({ authorName: "Ada", sourceUrl: "https://example.com/a" });
  });
});

describe("isHttpUrl", () => {
  it("accepts http(s) only", () => {
    expect(isHttpUrl("https://x.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
