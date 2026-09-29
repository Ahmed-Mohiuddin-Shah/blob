import type { Metadata, Viewport } from "next";
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
import { publicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteDescription =
  "A public sticker library — find something sticky.";

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: {
    default: "BLOB Sticker Library",
    template: "%s · BLOB",
  },
  description: siteDescription,
  applicationName: "BLOB",
  appleWebApp: {
    capable: true,
    title: "BLOB",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "BLOB",
    title: "BLOB Sticker Library",
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "BLOB Sticker Library",
    description: siteDescription,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f10ea0" },
  ],
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
        <link
          rel="preload"
          href="/fonts/Segoe%20UI.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Segoe%20UI%20Semibold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
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
