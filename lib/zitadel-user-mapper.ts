/** Map Zitadel OIDC claims → local user fields. No avatar — UI uses blobatar. */

export type ZitadelClaims = {
  sub: string;
  name?: string | null;
  email?: string | null;
  email_verified?: boolean;
  preferred_username?: string | null;
};

export type MappedUserAttrs = {
  zitadelId: string;
  username: string;
  displayName: string;
  email: string;
  emailVerifiedAt: Date | null;
};

export function attributesFromClaims(claims: ZitadelClaims): MappedUserAttrs {
  const email = String(claims.email ?? "");
  return {
    zitadelId: String(claims.sub),
    username: usernameFromClaims(claims, email, String(claims.sub)),
    displayName: String(claims.name || "User"),
    email,
    emailVerifiedAt: claims.email_verified ? new Date() : null,
  };
}

/** URL-safe handle from preferred_username / email local-part; collide-safe via sub suffix. */
export function usernameFromClaims(
  claims: Pick<ZitadelClaims, "preferred_username">,
  email: string,
  sub: string,
): string {
  const preferred = String(claims.preferred_username ?? "");
  let base = preferred !== "" ? preferred : email;
  if (base.includes("@")) {
    base = base.slice(0, base.indexOf("@"));
  }

  let slug = slugify(base).slice(0, 40);
  if (!slug) slug = "user";

  // ponytail: uniqueness via short sub suffix; ceiling = rare collisions on truncated handles
  return `${slug}_${sub.slice(-6).toLowerCase()}`.slice(0, 50);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
