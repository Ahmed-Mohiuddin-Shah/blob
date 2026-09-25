import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NewCollectionClient } from "@/components/new-collection-client";
import { getSession, signInUrl } from "@/lib/auth";

export default async function NewCollectionPage() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    redirect(signInUrl({ redirectTo: "/collections/new" }));
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
        Collections
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        New collection
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Public and uniquely named. You can add up to 60 stickers.
      </p>
      <div className="mt-10">
        <NewCollectionClient />
      </div>
    </section>
  );
}
