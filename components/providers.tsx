"use client";

import { BlobSkeletonTheme } from "./skeleton";

export function Providers({ children }: { children: React.ReactNode }) {
  return <BlobSkeletonTheme>{children}</BlobSkeletonTheme>;
}
