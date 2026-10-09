import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  randomPKCECodeVerifier,
  randomState,
} from "@/lib/zitadel-oidc";
import {
  COOKIE_OAUTH_REDIRECT,
  COOKIE_OAUTH_STATE,
  COOKIE_PKCE,
} from "@/lib/token-cookies";

function cookieOpts(maxAge = 600) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Start Zitadel Authorization Code + PKCE; set thin oauth cookies then redirect. */
export async function GET(request: NextRequest) {
  const redirectTo =
    request.nextUrl.searchParams.get("redirectTo") ||
    process.env.ZITADEL_POST_LOGIN_URL ||
    "/profile";

  const codeVerifier = randomPKCECodeVerifier();
  const state = randomState();
  const authorizeUrl = await buildAuthorizeUrl({ state, codeVerifier });

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set(COOKIE_PKCE, codeVerifier, cookieOpts());
  res.cookies.set(COOKIE_OAUTH_STATE, state, cookieOpts());
  res.cookies.set(COOKIE_OAUTH_REDIRECT, redirectTo, cookieOpts());
  return res;
}
