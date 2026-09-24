import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canEditAccountStatus,
  canManageAdmins,
  canManageUsers,
  canUpload,
  roleChangeError,
} from "@/lib/capabilities";
import {
  APP_ASSIGNABLE_ROLES,
  BLOB_ROLES,
  highestRole,
  isBlobRole,
  rolesFromClaims,
} from "@/lib/roles";

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

  it("prefers superadmin over admin", () => {
    expect(
      rolesFromClaims(
        {
          "urn:zitadel:iam:org:project:proj123:roles": {
            admin: { "1": "x" },
            superadmin: { "1": "x" },
          },
        },
        "proj123",
      ),
    ).toBe("superadmin");
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
    expect(highestRole(["admin", "superadmin"])).toBe("superadmin");
    expect(isBlobRole("member")).toBe(true);
    expect(isBlobRole("superadmin")).toBe(true);
    expect(BLOB_ROLES).toContain("superadmin");
  });
});

describe("capabilities", () => {
  it("treats superadmin as admin-capable", () => {
    const sa = { role: "superadmin", accountStatus: "active" };
    expect(canUpload(sa)).toBe(true);
    expect(canManageUsers(sa)).toBe(true);
    expect(canManageAdmins(sa)).toBe(true);
  });

  it("admin cannot manage admins", () => {
    const admin = { role: "admin", accountStatus: "active" };
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageAdmins(admin)).toBe(false);
  });
});

describe("roleChangeError", () => {
  const superadmin = {
    id: "1",
    role: "superadmin",
    accountStatus: "active",
  };
  const admin = { id: "2", role: "admin", accountStatus: "active" };
  const member = { id: "3", role: "member", accountStatus: "active" };

  it("rejects self role-edit", () => {
    expect(roleChangeError(superadmin, superadmin, "admin", 1)).toBe(
      "Cannot change your own role",
    );
    expect(roleChangeError(admin, admin, "user", 1)).toBe(
      "Cannot change your own role",
    );
  });

  it("allows self save when role unchanged", () => {
    expect(roleChangeError(superadmin, superadmin, "superadmin", 1)).toBeNull();
  });

  it("rejects admin promoting to admin", () => {
    expect(roleChangeError(admin, member, "admin", 1)).toBe(
      "Only a superadmin can change admin roles",
    );
  });

  it("rejects admin demoting another admin", () => {
    expect(roleChangeError(admin, { ...admin, id: "9" }, "member", 1)).toBe(
      "Only a superadmin can change admin roles",
    );
  });

  it("allows admin to change member roles", () => {
    expect(roleChangeError(admin, member, "user", 1)).toBeNull();
  });

  it("rejects demoting the last superadmin", () => {
    expect(
      roleChangeError(superadmin, { ...superadmin, id: "9" }, "admin", 1),
    ).toBe("Cannot demote the last superadmin");
  });

  it("allows demoting a non-last superadmin", () => {
    expect(
      roleChangeError(superadmin, { ...superadmin, id: "9" }, "admin", 2),
    ).toBeNull();
  });

  it("rejects promoting anyone to superadmin in-app", () => {
    expect(roleChangeError(superadmin, member, "superadmin", 1)).toBe(
      "superadmin can only be assigned in Zitadel",
    );
    expect(roleChangeError(superadmin, admin, "superadmin", 1)).toBe(
      "superadmin can only be assigned in Zitadel",
    );
  });
});

describe("assignableRoles / canEditAccountStatus", () => {
  const superadmin = {
    id: "1",
    role: "superadmin",
    accountStatus: "active",
  };
  const admin = { id: "2", role: "admin", accountStatus: "active" };
  const member = { id: "3", role: "member", accountStatus: "active" };

  it("own row has no assignable roles", () => {
    expect(assignableRoles(superadmin, superadmin)).toEqual([]);
  });

  it("admin only gets member roles on members; cannot edit status", () => {
    expect(assignableRoles(admin, member)).toEqual(["user", "member"]);
    expect(assignableRoles(admin, admin)).toEqual([]);
    expect(canEditAccountStatus(admin, member)).toBe(false);
    expect(canEditAccountStatus(admin, { ...admin, id: "9" })).toBe(false);
  });

  it("superadmin gets user/member/admin only — never superadmin", () => {
    expect(assignableRoles(superadmin, member)).toEqual([
      ...APP_ASSIGNABLE_ROLES,
    ]);
    expect(assignableRoles(superadmin, member)).not.toContain("superadmin");
    expect(canEditAccountStatus(superadmin, admin)).toBe(true);
    expect(canEditAccountStatus(superadmin, superadmin)).toBe(false);
  });
});
