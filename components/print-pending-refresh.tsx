"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Poll RSC while a print is still generating so recovery encode shows up. */
export function PrintPendingRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
