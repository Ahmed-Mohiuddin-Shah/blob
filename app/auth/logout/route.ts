import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/** Federated logout: clear Auth.js cookies, then Zitadel end_session with id_token_hint. */
export async function GET(req: Request) {
  const issuer = (process.env.ZITADEL_ISSUER || "").replace(/\/$/, "");
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const postLogout = process.env.ZITADEL_POST_LOGOUT_REDIRECT_URI || `${base}/auth/logout/callback`;

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  const idToken = (token as { idToken?: string } | null)?.idToken;

  const endSession = new URL(`${issuer}/oidc/v1/end_session`);
  if (idToken) endSession.searchParams.set("id_token_hint", idToken);
  endSession.searchParams.set("post_logout_redirect_uri", postLogout);
  if (process.env.ZITADEL_CLIENT_ID) {
    endSession.searchParams.set("client_id", process.env.ZITADEL_CLIENT_ID);
  }

  const response = NextResponse.redirect(endSession.toString());

  for (const name of [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]) {
    response.cookies.set(name, "", { expires: new Date(0), path: "/" });
  }

  return response;
}
