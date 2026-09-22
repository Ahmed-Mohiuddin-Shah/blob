import { describe, expect, it } from "vitest";
import { attributesFromClaims, usernameFromClaims } from "../lib/zitadel-user-mapper";

describe("usernameFromClaims", () => {
  it("uses preferred_username with sub suffix", () => {
    expect(usernameFromClaims({ preferred_username: "Maya.Coder" }, "maya@example.com", "abc123XYZ789")).toBe(
      "maya_coder_xyz789",
    );
  });

  it("falls back to email local-part", () => {
    expect(usernameFromClaims({}, "Hello.World@example.com", "sub000111")).toBe("hello_world_000111");
  });

  it("uses user_ when empty", () => {
    expect(usernameFromClaims({}, "", "zzzzzz")).toBe("user_zzzzzz");
  });
});

describe("attributesFromClaims", () => {
  it("maps verified email", () => {
    const attrs = attributesFromClaims({
      sub: "oidc-sub-123456",
      name: "Ada",
      email: "ada@example.com",
      email_verified: true,
      preferred_username: "ada",
    });
    expect(attrs.zitadelId).toBe("oidc-sub-123456");
    expect(attrs.displayName).toBe("Ada");
    expect(attrs.email).toBe("ada@example.com");
    expect(attrs.emailVerifiedAt).toBeInstanceOf(Date);
    expect(attrs.username).toMatch(/^ada_/);
    expect(attrs).not.toHaveProperty("avatarUrl");
  });

  it("leaves emailVerifiedAt null when unverified", () => {
    const attrs = attributesFromClaims({
      sub: "sub",
      email: "a@b.co",
      email_verified: false,
    });
    expect(attrs.emailVerifiedAt).toBeNull();
  });
});
