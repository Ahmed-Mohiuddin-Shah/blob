import { NextRequest, NextResponse } from "next/server";
import { clearTokenCookies } from "@/lib/token-cookies";

function appOrigin(): string {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Validate logout state, clear token cookies, redirect to success/error. */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const logoutStateCookie = request.cookies.get("logout_state");
  const origin = appOrigin();

  if (state && logoutStateCookie && state === logoutStateCookie.value) {
    const response = NextResponse.redirect(`${origin}/logout/success`, 302);
    clearTokenCookies(response);
    for (const name of request.cookies.getAll().map((c) => c.name)) {
      // Clear leftover Auth.js cookies from older deploys
      if (name.includes("authjs.")) {
        response.cookies.delete({ name, path: "/" });
      }
    }
    response.cookies.delete({
      name: "logout_state",
      path: "/api/auth/logout/callback",
    });
    return response;
  }

  const errorUrl = new URL("/logout/error", origin);
  errorUrl.searchParams.set("reason", "Invalid or missing state parameter.");
  return NextResponse.redirect(errorUrl, 302);
}
