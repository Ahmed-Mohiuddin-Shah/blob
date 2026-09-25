import type { Metadata } from "next";
import { headers } from "next/headers";
import { BlobBackground } from "@/components/blob-background";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";
import { getSession } from "@/lib/auth";
import { canManageUsers, canUpload } from "@/lib/capabilities";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLOB Sticker Library",
  description: "A public sticker library — find something sticky.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );

  let user: {
    name?: string | null;
    username?: string | null;
    displayName?: string | null;
  } | null = null;
  let canUploadFlag = false;
  let pendingApprovalCount = 0;

  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
    });
    if (dbUser) {
      user = {
        name: session.user.name,
        username: dbUser.username,
        displayName: dbUser.displayName,
      };
      const caps = { role: dbUser.role, accountStatus: dbUser.accountStatus };
      canUploadFlag = canUpload(caps);
      if (canManageUsers(caps)) {
        pendingApprovalCount = await prisma.sticker.count({
          where: { moderationStatus: MODERATION_STATUS.pendingReview },
        });
      } else {
        pendingApprovalCount = await prisma.sticker.count({
          where: {
            moderationStatus: MODERATION_STATUS.needsEdit,
            uploadedById: dbUser.id,
          },
        });
      }
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <Providers>
          <BlobBackground />
          <div className="min-h-screen overflow-x-clip">
            <Header
              user={user}
              canUpload={canUploadFlag}
              pendingApprovalCount={pendingApprovalCount}
            />
            <main>{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
