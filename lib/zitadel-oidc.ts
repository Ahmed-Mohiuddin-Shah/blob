import * as oidc from "openid-client";
import { zitadelScopes } from "@/lib/scopes";

let cachedConfig: oidc.Configuration | null = null;

export async function zitadelConfig(): Promise<oidc.Configuration> {
  if (cachedConfig) return cachedConfig;
  const domain = process.env.ZITADEL_DOMAIN;
  const clientId = process.env.ZITADEL_CLIENT_ID;
  if (!domain || !clientId) {
    throw new Error("ZITADEL_DOMAIN and ZITADEL_CLIENT_ID are required");
  }
  const secret = process.env.ZITADEL_CLIENT_SECRET;
  cachedConfig = await oidc.discovery(
    new URL(domain),
    clientId,
    secret || undefined,
    secret ? oidc.ClientSecretPost(secret) : undefined,
  );
  return cachedConfig;
}

export function callbackUrl(): string {
  const url = process.env.ZITADEL_CALLBACK_URL;
  if (!url) throw new Error("ZITADEL_CALLBACK_URL is not set");
  return url;
}

export async function buildAuthorizeUrl(opts: {
  state: string;
  codeVerifier: string;
}): Promise<URL> {
  const config = await zitadelConfig();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(opts.codeVerifier);
  return oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl(),
    scope: zitadelScopes(),
    state: opts.state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
}

export async function exchangeAuthorizationCode(opts: {
  currentUrl: URL;
  codeVerifier: string;
  expectedState: string;
}): Promise<oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers> {
  const config = await zitadelConfig();
  return oidc.authorizationCodeGrant(config, opts.currentUrl, {
    pkceCodeVerifier: opts.codeVerifier,
    expectedState: opts.expectedState,
  });
}

export async function refreshTokens(refreshToken: string) {
  const config = await zitadelConfig();
  return oidc.refreshTokenGrant(config, refreshToken);
}

export async function buildLogoutUrl(
  idToken: string,
): Promise<{ url: string; state: string }> {
  const config = await zitadelConfig();
  const state = oidc.randomState();
  const urlObj = oidc.buildEndSessionUrl(config, {
    id_token_hint: idToken,
    post_logout_redirect_uri: process.env.ZITADEL_POST_LOGOUT_URL!,
    state,
  });
  return { url: urlObj.toString(), state };
}

export { randomPKCECodeVerifier, randomState } from "openid-client";
