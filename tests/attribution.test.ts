import { describe, expect, it } from "vitest";
import { isHttpUrl, CLAIM_REASON, CLAIM_STATUS } from "@/lib/attribution";

describe("isHttpUrl", () => {
  it("accepts http(s)", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects non-http", () => {
    expect(isHttpUrl("ftp://nope")).toBe(false);
    expect(isHttpUrl("not-a-url")).toBe(false);
  });
});

describe("claim constants", () => {
  it("exposes reason and status enums", () => {
    expect(CLAIM_REASON.missing).toBe("missing");
    expect(CLAIM_STATUS.pending).toBe("pending");
  });
});
