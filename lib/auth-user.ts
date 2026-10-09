import type { User } from "@prisma/client";
import { verifyAccessToken } from "@/lib/zitadel-jwt";
import { COOKIE_AT, readCookie } from "@/lib/token-cookies";
import { bearerFromRequest } from "@/lib/jobs/auth";

/**
 * Resolve the local user from a Zitadel access token.
 * Token source: Authorization Bearer, else blob_at cookie.
 */
export async function authUser(request?: Request): Promise<User | null> {
  let token: string | null = null;

  if (request) {
    token = bearerFromRequest(request);
    if (!token) {
      token = readCookie(request.headers.get("cookie"), COOKIE_AT);
    }
  } else {
    const { headers } = await import("next/headers");
    const h = await headers();
    const auth = h.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7).trim() || null;
    }
    if (!token) {
      token = readCookie(h.get("cookie"), COOKIE_AT);
    }
  }

  if (!token) return null;

  // Worker keys are not Zitadel JWTs
  if (token.startsWith("blob_wk_")) return null;

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return null;
  }

  const sub = payload.sub;
  if (!sub) return null;

  const { prisma } = await import("@/lib/prisma");
  return prisma.user.findUnique({ where: { zitadelId: sub } });
}
