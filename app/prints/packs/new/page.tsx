import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreatePackForm } from "@/components/create-pack-form";
import { getSession, signInUrl } from "@/lib/auth";
import { canUpload } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";

export default async function NewPackPage({
  searchParams,
}: {
  searchParams: Promise<{ sheets?: string; packs?: string }>;
}) {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    redirect(signInUrl({ redirectTo: "/prints/packs/new" }));
  }
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !user ||
    !canUpload({ role: user.role, accountStatus: user.accountStatus })
  ) {
    redirect("/prints");
  }

  const sp = await searchParams;
  const initialSheetIds = (sp.sheets ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const initialPackIds = (sp.packs ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm">
        <Link href="/prints" className="text-accent-pink hover:underline">
          ← Prints
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        new sticker pack
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Bundle at least two sheets. Packs store references to the original
        sheets and are always public.
      </p>
      <div className="mt-8">
        <CreatePackForm
          initialSheetIds={initialSheetIds}
          initialPackIds={initialPackIds}
        />
      </div>
    </section>
  );
}
