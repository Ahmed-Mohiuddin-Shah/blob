import { describe, expect, it } from "vitest";
import { BLOB_ROLES, highestRole, isBlobRole, rolesFromClaims } from "@/lib/roles";

describe("rolesFromClaims", () => {
  it("reads classic project roles claim", () => {
    expect(
      rolesFromClaims({
        "urn:zitadel:iam:org:project:roles": {
          member: { "1": "example.com" },
          user: { "1": "example.com" },
        },
      }),
    ).toBe("member");
  });

  it("prefers admin and reads project-scoped claim", () => {
    expect(
      rolesFromClaims(
        {
          "urn:zitadel:iam:org:project:proj123:roles": {
            admin: { "1": "x" },
          },
        },
        "proj123",
      ),
    ).toBe("admin");
  });

  it("defaults to user", () => {
    expect(rolesFromClaims({})).toBe("user");
  });
});

describe("highestRole", () => {
  it("picks max known role", () => {
    expect(highestRole(["user", "admin", "nope"])).toBe("admin");
    expect(isBlobRole("member")).toBe(true);
    expect(BLOB_ROLES).toContain("user");
  });
});
