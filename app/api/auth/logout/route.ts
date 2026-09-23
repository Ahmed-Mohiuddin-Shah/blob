import { NextResponse } from "next/server";
import { buildLogoutUrl, getSession } from "@/lib/auth";

/** Start RP-initiated logout: redirect to ZITADEL end_session with CSRF state cookie. */
export async function POST(request: Request) {
  const session = await getSession(request);

  if (!session?.idToken) {
    return NextResponse.json(
      { error: "No valid session or ID token found" },
      { status: 400 },
    );
  }

  const { url, state } = await buildLogoutUrl(session.idToken);
  const response = NextResponse.redirect(url);

  response.cookies.set("logout_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/logout/callback",
  });

  return response;
}
