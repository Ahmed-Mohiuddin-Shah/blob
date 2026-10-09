import type { User } from "@prisma/client";
import { authUser } from "@/lib/auth-user";
import { buildLogoutUrl as oidcBuildLogoutUrl } from "@/lib/zitadel-oidc";

export { signInUrl, signOutUrl } from "@/lib/auth-urls";

/** Compat session shape used by pages/APIs that previously used Auth.js. */
export type AppSession = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    username: string;
    displayName: string;
    role: string;
    accountStatus: string;
  };
};

function sessionFromUser(user: User): AppSession {
  return {
    user: {
      id: user.id.toString(),
      name: user.displayName,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      accountStatus: user.accountStatus,
    },
  };
}

/**
 * Resolve signed-in user via JWKS-verified access token (Bearer or cookie).
 * Drop-in replacement for Auth.js getSession.
 */
export async function getSession(
  request?: Request,
): Promise<AppSession | null> {
  const user = await authUser(request);
  return user ? sessionFromUser(user) : null;
}

export async function buildLogoutUrl(
  idToken: string,
): Promise<{ url: string; state: string }> {
  return oidcBuildLogoutUrl(idToken);
}
