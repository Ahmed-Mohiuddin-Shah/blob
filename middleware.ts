import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJwt } from "jose";
import { canManageUsers } from "@/lib/capabilities";
import { ACCOUNT_STATUS, rolesFromClaims } from "@/lib/roles";
import { refreshTokens } from "@/lib/zitadel-oidc";
import { verifyAccessToken } from "@/lib/zitadel-jwt";
import { zitadelProjectId } from "@/lib/zitadel-mgmt";
import {
  COOKIE_AT,
  COOKIE_RT,
  patchCookieHeader,
  setTokenCookies,
  type TokenBundle,
} from "@/lib/token-cookies";

function accessTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwt(token);
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return true;
  }
}

async function maybeRefresh(
  request: NextRequest,
): Promise<{ accessToken: string | null; bundle: TokenBundle | null }> {
  const at = request.cookies.get(COOKIE_AT)?.value ?? null;
  const rt = request.cookies.get(COOKIE_RT)?.value;
  if (at && !accessTokenExpired(at)) {
    return { accessToken: at, bundle: null };
  }
  if (!rt) {
    return { accessToken: at, bundle: null };
  }
  try {
    const tokens = await refreshTokens(rt);
    return {
      accessToken: tokens.access_token,
      bundle: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? rt,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
      },
    };
  } catch (err) {
    console.warn("Token refresh failed:", err);
    return { accessToken: null, bundle: null };
  }
}

async function adminBlocked(
  request: NextRequest,
  accessToken: string | null,
): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith("/admin")) return null;

  const redirectProfile = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    return NextResponse.redirect(url);
  };

  if (!accessToken) return redirectProfile();

  try {
    const payload = await verifyAccessToken(accessToken);
    const role = rolesFromClaims(
      payload as Record<string, unknown>,
      zitadelProjectId(),
    );
    // ponytail: no Prisma in middleware; pages re-check account_status from DB
    if (
      !canManageUsers({
        role,
        accountStatus: ACCOUNT_STATUS.active,
      })
    ) {
      return redirectProfile();
    }
  } catch {
    return redirectProfile();
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { accessToken, bundle } = await maybeRefresh(request);

  const requestHeaders = new Headers(request.headers);
  if (bundle) {
    let cookie = requestHeaders.get("cookie");
    cookie = patchCookieHeader(cookie, COOKIE_AT, bundle.accessToken);
    if (bundle.refreshToken) {
      cookie = patchCookieHeader(cookie, COOKIE_RT, bundle.refreshToken);
    }
    requestHeaders.set("cookie", cookie);
  } else if (!accessToken && request.cookies.get(COOKIE_AT)?.value) {
    // Clear stale AT from the inbound cookie view
    requestHeaders.set(
      "cookie",
      patchCookieHeader(requestHeaders.get("cookie"), COOKIE_AT, null),
    );
  }

  const blocked = await adminBlocked(request, accessToken);
  if (blocked) {
    if (bundle) setTokenCookies(blocked, bundle);
    else if (!accessToken) {
      blocked.cookies.set(COOKIE_AT, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return blocked;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (bundle) setTokenCookies(res, bundle);
  else if (!accessToken && request.cookies.get(COOKIE_AT)?.value) {
    res.cookies.set(COOKIE_AT, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
