import { NextResponse } from "next/server";
import { buildLogoutUrl } from "@/lib/auth";
import { COOKIE_ID, clearTokenCookies, readCookie } from "@/lib/token-cookies";

/** Start RP-initiated logout: redirect to ZITADEL end_session with CSRF state cookie. */
export async function POST(request: Request) {
  const idToken = readCookie(request.headers.get("cookie"), COOKIE_ID);

  if (!idToken) {
    const origin = (process.env.AUTH_URL || "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    const res = NextResponse.redirect(`${origin}/logout/success`, 302);
    clearTokenCookies(res);
    return res;
  }

  const { url, state } = await buildLogoutUrl(idToken);
  const response = NextResponse.redirect(url);

  clearTokenCookies(response);
  response.cookies.set("logout_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/logout/callback",
  });

  return response;
}
