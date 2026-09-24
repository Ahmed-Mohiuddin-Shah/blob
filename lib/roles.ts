/** Coarse BLOB roles — Zitadel project role keys + local mirror. */

export const BLOB_ROLES = ["user", "member", "admin", "superadmin"] as const;
export type BlobRole = (typeof BLOB_ROLES)[number];

/** Roles an admin (non-superadmin) may assign. */
export const MEMBER_ROLES = ["user", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/**
 * Roles the BLOB admin UI may assign. `superadmin` is Zitadel-only
 * (bootstrap / console) — never offered in-app.
 */
export const APP_ASSIGNABLE_ROLES = ["user", "member", "admin"] as const;

const RANK: Record<BlobRole, number> = {
  user: 1,
  member: 2,
  admin: 3,
  superadmin: 4,
};

export function isBlobRole(value: string): value is BlobRole {
  return (BLOB_ROLES as readonly string[]).includes(value);
}

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

/** Admin or superadmin — elevated management ranks. */
export function isAdminRank(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

/** Highest of known BLOB roles; default `user`. */
export function highestRole(keys: Iterable<string>): BlobRole {
  let best: BlobRole = "user";
  for (const key of keys) {
    if (isBlobRole(key) && RANK[key] > RANK[best]) best = key;
  }
  return best;
}

/**
 * Parse Zitadel project-roles claims from ID token / profile.
 * Shapes: `{ "admin": { orgId: "domain" }, ... }` or project-scoped claim key.
 */
export function rolesFromClaims(
  claims: Record<string, unknown>,
  projectId?: string,
): BlobRole {
  const keys = new Set<string>();

  const collect = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value as Record<string, unknown>)) {
      keys.add(key);
    }
  };

  collect(claims["urn:zitadel:iam:org:project:roles"]);
  if (projectId) {
    collect(claims[`urn:zitadel:iam:org:project:${projectId}:roles`]);
  }

  return highestRole(keys);
}
