import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function issuer(): string {
  const domain = process.env.ZITADEL_DOMAIN;
  if (!domain) throw new Error("ZITADEL_DOMAIN is not set");
  return domain.replace(/\/$/, "");
}

function apiAudience(): string {
  const aud = process.env.ZITADEL_API_CLIENT_ID;
  if (!aud) throw new Error("ZITADEL_API_CLIENT_ID is not set");
  return aud;
}

function remoteJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer()}/oauth/v2/keys`));
  }
  return jwks;
}

/** Claim checks shared with tests — no crypto. */
export function assertAccessTokenClaims(payload: JWTPayload): void {
  const iss = issuer();
  const aud = apiAudience();
  if (payload.iss !== iss) {
    throw new Error(`invalid issuer: ${String(payload.iss)}`);
  }
  const claimAud = payload.aud;
  const audOk = Array.isArray(claimAud)
    ? claimAud.includes(aud)
    : claimAud === aud;
  if (!audOk) {
    throw new Error(`invalid audience: ${JSON.stringify(claimAud)}`);
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("missing sub");
  }
}

/**
 * Verify a Zitadel access token via JWKS.
 * Requires iss = ZITADEL_DOMAIN and aud includes ZITADEL_API_CLIENT_ID.
 */
export async function verifyAccessToken(
  token: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, remoteJwks(), {
    issuer: issuer(),
    audience: apiAudience(),
  });
  assertAccessTokenClaims(payload);
  return payload;
}
