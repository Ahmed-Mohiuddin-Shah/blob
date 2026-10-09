import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertAccessTokenClaims } from "@/lib/zitadel-jwt";

describe("assertAccessTokenClaims", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.ZITADEL_DOMAIN = "https://auth.example.com";
    process.env.ZITADEL_API_CLIENT_ID = "api-client-123";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("accepts matching iss, aud, sub", () => {
    expect(() =>
      assertAccessTokenClaims({
        iss: "https://auth.example.com",
        aud: "api-client-123",
        sub: "user-1",
      }),
    ).not.toThrow();
  });

  it("accepts aud as array containing API client id", () => {
    expect(() =>
      assertAccessTokenClaims({
        iss: "https://auth.example.com",
        aud: ["other", "api-client-123"],
        sub: "user-1",
      }),
    ).not.toThrow();
  });

  it("rejects wrong issuer", () => {
    expect(() =>
      assertAccessTokenClaims({
        iss: "https://evil.example.com",
        aud: "api-client-123",
        sub: "user-1",
      }),
    ).toThrow(/issuer/);
  });

  it("rejects wrong audience", () => {
    expect(() =>
      assertAccessTokenClaims({
        iss: "https://auth.example.com",
        aud: "wrong-client",
        sub: "user-1",
      }),
    ).toThrow(/audience/);
  });

  it("rejects missing sub", () => {
    expect(() =>
      assertAccessTokenClaims({
        iss: "https://auth.example.com",
        aud: "api-client-123",
      }),
    ).toThrow(/sub/);
  });
});
