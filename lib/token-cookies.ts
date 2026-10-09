import type { NextResponse } from "next/server";

/** Thin httpOnly token cookies — not an Auth.js session JWT. */
export const COOKIE_AT = "blob_at";
export const COOKIE_RT = "blob_rt";
export const COOKIE_ID = "blob_id";
export const COOKIE_PKCE = "blob_pkce";
export const COOKIE_OAUTH_STATE = "blob_oauth_state";
export const COOKIE_OAUTH_REDIRECT = "blob_oauth_redirect";

const TOKEN_COOKIE_NAMES = [COOKIE_AT, COOKIE_RT, COOKIE_ID] as const;

export type TokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  idToken?: string | null;
  /** Access token lifetime in seconds (for Max-Age). */
  expiresIn?: number | null;
};

function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

function baseOpts(maxAge?: number) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge != null && maxAge > 0 ? { maxAge } : {}),
  };
}

/** Apply AT/RT/ID cookies onto a NextResponse (login, refresh, middleware). */
export function setTokenCookies(res: NextResponse, tokens: TokenBundle): void {
  const atMax =
    tokens.expiresIn && tokens.expiresIn > 0
      ? tokens.expiresIn
      : 60 * 60;
  res.cookies.set(COOKIE_AT, tokens.accessToken, baseOpts(atMax));
  if (tokens.refreshToken) {
    // ponytail: 30d RT cookie; Zitadel may revoke sooner — refresh grant is source of truth
    res.cookies.set(COOKIE_RT, tokens.refreshToken, baseOpts(60 * 60 * 24 * 30));
  }
  if (tokens.idToken) {
    res.cookies.set(COOKIE_ID, tokens.idToken, baseOpts(60 * 60 * 24 * 30));
  }
}

export function clearTokenCookies(res: NextResponse): void {
  for (const name of TOKEN_COOKIE_NAMES) {
    res.cookies.set(name, "", { ...baseOpts(0), maxAge: 0 });
  }
}

export function clearOauthCookies(res: NextResponse): void {
  for (const name of [COOKIE_PKCE, COOKIE_OAUTH_STATE, COOKIE_OAUTH_REDIRECT]) {
    res.cookies.set(name, "", { ...baseOpts(0), maxAge: 0 });
  }
}

/** Replace/remove a cookie value inside a Cookie request header string. */
export function patchCookieHeader(
  cookieHeader: string | null,
  name: string,
  value: string | null,
): string {
  const parts = (cookieHeader ?? "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith(`${name}=`));
  if (value != null && value !== "") {
    parts.push(`${name}=${value}`);
  }
  return parts.join("; ");
}

export function readCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) === name) {
      return trimmed.slice(eq + 1) || null;
    }
  }
  return null;
}
