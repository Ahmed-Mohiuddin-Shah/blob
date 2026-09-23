/**
 * ZITADEL OAuth 2.0 / OpenID Connect scopes used by blob.
 * Roles live in Postgres, not ZITADEL project roles — no URN role scopes.
 */
export const ZITADEL_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
].join(" ");
