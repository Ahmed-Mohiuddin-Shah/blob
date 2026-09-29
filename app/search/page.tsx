import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteSearch } from "@/components/site-search";
import { getSession } from "@/lib/auth";
import { defaultSearchMode, type CapabilityUser } from "@/lib/capabilities";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Search",
  description: "Search stickers, collections, prints, and blobbers on BLOB.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  const capUser: CapabilityUser | null = session?.user?.id
    ? {
        role: session.user.role ?? "user",
        accountStatus: session.user.accountStatus ?? "active",
      }
    : null;
  const fallback = defaultSearchMode(capUser);

  return (
    <Suspense fallback={<div className="p-10 text-secondary">Loading search…</div>}>
      <SiteSearch
        initialQ={sp.q ?? ""}
        initialMode={sp.mode ?? fallback}
        capUser={capUser}
      />
    </Suspense>
  );
}
