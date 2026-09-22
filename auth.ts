import NextAuth from "next-auth";
import Zitadel from "next-auth/providers/zitadel";
import { attributesFromClaims } from "@/lib/zitadel-user-mapper";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      username: string;
      displayName: string;
      role: string;
      accountStatus: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    displayName?: string;
    role?: string;
    accountStatus?: string;
    idToken?: string;
  }
}

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Zitadel({
      issuer: process.env.ZITADEL_ISSUER,
      clientId: process.env.ZITADEL_CLIENT_ID,
      // Auth.js still wants a secret even for PKCE public clients
      clientSecret: process.env.ZITADEL_CLIENT_SECRET || process.env.AUTH_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "zitadel" || !profile?.sub) return false;

      const prisma = await getPrisma();
      const attrs = attributesFromClaims({
        sub: profile.sub,
        name: profile.name,
        email: profile.email,
        email_verified: Boolean((profile as { email_verified?: boolean }).email_verified),
        preferred_username: (profile as { preferred_username?: string }).preferred_username,
      });

      const existing = await prisma.user.findUnique({ where: { zitadelId: attrs.zitadelId } });

      if (!existing) {
        await prisma.user.create({
          data: {
            zitadelId: attrs.zitadelId,
            username: attrs.username,
            displayName: attrs.displayName,
            email: attrs.email,
            emailVerifiedAt: attrs.emailVerifiedAt,
            role: "user",
            accountStatus: "active",
          },
        });
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            displayName: attrs.displayName,
            email: attrs.email,
            emailVerifiedAt: attrs.emailVerifiedAt,
          },
        });
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
      }

      // Only hit DB on sign-in (profile present). Middleware must stay Edge-safe.
      if (profile?.sub) {
        const prisma = await getPrisma();
        const user = await prisma.user.findUnique({ where: { zitadelId: profile.sub } });
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
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId ?? "";
        session.user.username = token.username ?? "";
        session.user.displayName = token.displayName ?? session.user.name ?? "";
        session.user.role = token.role ?? "user";
        session.user.accountStatus = token.accountStatus ?? "active";
        session.user.name = token.displayName ?? session.user.name;
      }
      return session;
    },
  },
});
