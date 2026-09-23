/**
 * ZITADEL OAuth 2.0 / OpenID Connect scopes used by blob.
 * Project roles come from Zitadel claims (mirrored to users.role).
 */
export function zitadelScopes(): string {
  const scopes = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "urn:zitadel:iam:org:projects:roles",
  ];
  const projectId = process.env.ZITADEL_PROJECT_ID;
  if (projectId) {
    scopes.push(`urn:zitadel:iam:org:project:id:${projectId}:aud`);
  }
  return scopes.join(" ");
}

/** @deprecated use zitadelScopes() — kept for any static imports */
export const ZITADEL_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "urn:zitadel:iam:org:projects:roles",
].join(" ");
