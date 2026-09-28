"use client";

import { SessionProvider } from "@zitadel/next-auth/react";
import { BlobSkeletonTheme } from "./skeleton";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BlobSkeletonTheme>{children}</BlobSkeletonTheme>
    </SessionProvider>
  );
}
