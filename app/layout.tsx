import type { Metadata } from "next";
import { headers } from "next/headers";
import { BlobBackground } from "@/components/blob-background";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";
import { getSession } from "@/lib/auth";
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
  const user = session?.user
    ? {
        name: session.user.name,
        username: session.user.username,
        displayName: session.user.displayName,
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <Providers>
          <BlobBackground />
          <div className="min-h-screen overflow-hidden">
            <Header user={user} />
            <main>{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
