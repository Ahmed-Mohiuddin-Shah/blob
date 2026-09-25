import Link from "next/link";
import { headers } from "next/headers";
import { getSession, signInUrl } from "@/lib/auth";
import { canUpload } from "@/lib/capabilities";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { PrintsLibrary } from "@/components/prints-library";

export default async function PrintsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  let canCreate = false;
  let sheetCount = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
    });
    if (user) {
      canCreate = canUpload({
        role: user.role,
        accountStatus: user.accountStatus,
      });
      sheetCount = await prisma.stickerSheet.count({
        where: { status: PRINT_STATUS.ready },
      });
    }
  } else {
    sheetCount = await prisma.stickerSheet.count({
      where: { status: PRINT_STATUS.ready },
    });
  }

  const signInHref = signInUrl({ redirectTo: "/prints" });

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-pink">
        Prints
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
        sticker sheets & packs
      </h1>
      <p className="mt-3 max-w-xl text-sm text-secondary sm:text-base">
        Lay stickers on a printable page, then bundle sheets into packs. Sheets
        and packs are always public and stay in the library.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {canCreate ? (
          <>
            <Link
              href="/prints/sheets/new"
              className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
            >
              Create sticker sheet
            </Link>
            <Link
              href="/prints/packs/new"
              className={`rounded-full border border-divider px-5 py-2.5 text-sm font-semibold ${
                sheetCount < 2 ? "pointer-events-none opacity-40" : ""
              }`}
              title={
                sheetCount < 2
                  ? "Need at least 2 ready sheets in the library"
                  : undefined
              }
            >
              Create sticker pack
            </Link>
          </>
        ) : (
          <Link
            href={signInHref}
            className="rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            Sign in to create
          </Link>
        )}
      </div>

      <div className="mt-12">
        <PrintsLibrary
          signedIn={!!session?.user?.id}
          signInHref={signInHref}
          initialQ={q ?? ""}
        />
      </div>
    </section>
  );
}
