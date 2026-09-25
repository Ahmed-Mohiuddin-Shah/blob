import { CollectionsLibrary } from "@/components/collections-library";
import { headers } from "next/headers";
import { getSession, signInUrl } from "@/lib/auth";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  const signedIn = !!session?.user?.id;
  const signInHref = signInUrl({ redirectTo: "/collections" });

  return (
    <CollectionsLibrary
      initialQ={sp.q ?? ""}
      signedIn={signedIn}
      signInHref={signInHref}
    />
  );
}
