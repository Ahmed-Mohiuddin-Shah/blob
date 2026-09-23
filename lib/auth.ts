import { type NextAuthConfig, NextAuth } from "@zitadel/next-auth";
import Zitadel from "@auth/core/providers/zitadel";
import { randomUUID } from "crypto";
import * as oidc from "openid-client";
import type { JWT } from "@auth/core/jwt";
import { attributesFromClaims } from "@/lib/zitadel-user-mapper";
import { rolesFromClaims } from "@/lib/roles";
import { zitadelScopes } from "@/lib/scopes";
import { setUserRole, zitadelProjectId } from "@/lib/zitadel-mgmt";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    console.error("No refresh token available for refresh");
    return { ...token, error: "RefreshAccessTokenError" };
  }
  try {
    const config = await oidc.discovery(
      new URL(process.env.ZITADEL_DOMAIN!),
      process.env.ZITADEL_CLIENT_ID!,
      process.env.ZITADEL_CLIENT_SECRET,
    );
    const tokenEndpointResponse = await oidc.refreshTokenGrant(
      config,
      token.refreshToken as string,
    );
    return {
      ...token,
      accessToken: tokenEndpointResponse.access_token,
      expiresAt: tokenEndpointResponse.expires_in
        ? Date.now() + tokenEndpointResponse.expires_in * 1000
        : Date.now() + 3600 * 1000,
      refreshToken: tokenEndpointResponse.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("Token refresh failed:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

/** Build ZITADEL end_session URL with CSRF state (official example pattern). */
export async function buildLogoutUrl(
  idToken: string,
): Promise<{ url: string; state: string }> {
  const config = await oidc.discovery(
    new URL(process.env.ZITADEL_DOMAIN!),
    process.env.ZITADEL_CLIENT_ID!,
    process.env.ZITADEL_CLIENT_SECRET,
  );
  const state = randomUUID();
  const urlObj = oidc.buildEndSessionUrl(config, {
    id_token_hint: idToken,
    post_logout_redirect_uri: process.env.ZITADEL_POST_LOGOUT_URL!,
    state,
  });
  return { url: urlObj.toString(), state };
}

export const authOptions: NextAuthConfig = {
  providers: [
    Zitadel({
      issuer: process.env.ZITADEL_DOMAIN!,
      clientId: process.env.ZITADEL_CLIENT_ID!,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET!,
      authorization: { params: { scope: zitadelScopes() } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: Number(process.env.SESSION_DURATION) || 3600,
  },
  secret: process.env.SESSION_SECRET,
  pages: { signIn: "/auth/login", error: "/auth/error" },
  callbacks: {
    async redirect({ baseUrl }) {
      const postLoginUrl = process.env.ZITADEL_POST_LOGIN_URL || "/profile";
      return postLoginUrl.startsWith("http")
        ? postLoginUrl
        : `${baseUrl}${postLoginUrl}`;
    },
    async signIn({ account, profile }) {
      if (account?.provider !== "zitadel" || !profile?.sub) return false;

      const prisma = await getPrisma();
      const attrs = attributesFromClaims({
        sub: profile.sub,
        name: profile.name,
        email: profile.email,
        email_verified: Boolean(
          (profile as { email_verified?: boolean }).email_verified,
        ),
        preferred_username: (profile as { preferred_username?: string })
          .preferred_username,
      });

      const role = rolesFromClaims(
        profile as Record<string, unknown>,
        zitadelProjectId(),
      );

      const existing = await prisma.user.findUnique({
        where: { zitadelId: attrs.zitadelId },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            zitadelId: attrs.zitadelId,
            username: attrs.username,
            displayName: attrs.displayName,
            email: attrs.email,
            emailVerifiedAt: attrs.emailVerifiedAt,
            role,
            accountStatus: "active",
          },
        });
        // Seed Zitadel grant so console/app stay aligned (ignore if PAT unset)
        try {
          await setUserRole(attrs.zitadelId, role);
        } catch (err) {
          console.warn("Zitadel setUserRole on signup skipped:", err);
        }
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            displayName: attrs.displayName,
            email: attrs.email,
            emailVerifiedAt: attrs.emailVerifiedAt,
            role,
          },
        });
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.idToken = account.id_token;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        token.error = undefined;
      }

      if (profile?.sub) {
        const prisma = await getPrisma();
        const user = await prisma.user.findUnique({
          where: { zitadelId: profile.sub },
        });
        if (user) {
          token.userId = user.id.toString();
          token.username = user.username;
          token.displayName = user.displayName;
          token.role = user.role;
          token.accountStatus = user.accountStatus;
          token.name = user.displayName;
          token.email = user.email;
          token.sub = profile.sub;
        }
        return token;
      }

      if (Date.now() < (token.expiresAt as number)) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.idToken = token.idToken as string | undefined;
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.username = token.username ?? "";
        session.user.displayName =
          token.displayName ?? session.user.name ?? "";
        session.user.role = token.role ?? "user";
        session.user.accountStatus = token.accountStatus ?? "active";
        session.user.name = token.displayName ?? session.user.name;
      }
      return session;
    },
  },
};

export const { handlers, getSession, signInUrl, signOutUrl } =
  NextAuth(authOptions);
