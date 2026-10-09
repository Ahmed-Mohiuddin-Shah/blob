import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { exchangeAuthorizationCode } from "@/lib/zitadel-oidc";
import { upsertUserFromClaims } from "@/lib/zitadel-signup";
import {
  COOKIE_OAUTH_REDIRECT,
  COOKIE_OAUTH_STATE,
  COOKIE_PKCE,
  clearOauthCookies,
  setTokenCookies,
} from "@/lib/token-cookies";

function appOrigin(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** OAuth callback origin must follow AUTH_URL (behind reverse proxies). */
function callbackUrl(req: NextRequest): URL {
  const authUrl = process.env.AUTH_URL;
  if (!authUrl) return req.nextUrl;
  const { origin: envOrigin } = new URL(authUrl);
  return new URL(req.nextUrl.href.replace(req.nextUrl.origin, envOrigin));
}

function safeRedirectPath(raw: string | undefined): string {
  const fallback = process.env.ZITADEL_POST_LOGIN_URL || "/profile";
  if (!raw) return fallback.startsWith("/") ? fallback : `/${fallback}`;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const u = new URL(raw);
    if (u.origin === appOrigin()) return u.pathname + u.search;
  } catch {
    /* ignore */
  }
  return fallback.startsWith("/") ? fallback : `/${fallback}`;
}

/** OIDC callback: exchange code, upsert user, set thin AT/RT/ID cookies. */
export async function GET(request: NextRequest) {
  const origin = appOrigin();
  const codeVerifier = request.cookies.get(COOKIE_PKCE)?.value;
  const expectedState = request.cookies.get(COOKIE_OAUTH_STATE)?.value;
  const redirectRaw = request.cookies.get(COOKIE_OAUTH_REDIRECT)?.value;

  if (!codeVerifier || !expectedState) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=MissingPKCE`,
      302,
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      currentUrl: callbackUrl(request),
      codeVerifier,
      expectedState,
    });

    const idClaims = (tokens.claims() ?? {}) as Record<string, unknown>;
    let atClaims: Record<string, unknown> = {};
    try {
      atClaims = decodeJwt(tokens.access_token) as Record<string, unknown>;
    } catch {
      /* opaque AT — roles come from id token if present */
    }
    const claims = {
      ...atClaims,
      ...idClaims,
      sub: (idClaims.sub ?? atClaims.sub) as string | undefined,
    };
    if (!claims.sub) {
      return NextResponse.redirect(
        `${origin}/auth/error?error=MissingClaims`,
        302,
      );
    }
    await upsertUserFromClaims(claims);

    const path = safeRedirectPath(redirectRaw);
    const res = NextResponse.redirect(`${origin}${path}`, 302);
    setTokenCookies(res, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
    });
    clearOauthCookies(res);
    return res;
  } catch (err) {
    console.error("OIDC callback failed:", err);
    const res = NextResponse.redirect(
      `${origin}/auth/error?error=Callback`,
      302,
    );
    clearOauthCookies(res);
    return res;
  }
}
