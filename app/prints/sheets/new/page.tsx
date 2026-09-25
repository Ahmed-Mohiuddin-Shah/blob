import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreateSheetForm } from "@/components/create-sheet-form";
import type { PickerSticker } from "@/components/sticker-picker-dialog";
import { getSession, signInUrl } from "@/lib/auth";
import { canUpload } from "@/lib/capabilities";
import { MAX_SHEET_STICKERS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { VISIBILITY } from "@/lib/stickers";

export default async function NewSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; collection?: string }>;
}) {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    redirect(signInUrl({ redirectTo: "/prints/sheets/new" }));
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
  let initial: PickerSticker[] = [];

  if (sp.ids) {
    const ids = sp.ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_SHEET_STICKERS);
    const bigIds = ids.flatMap((id) => {
      try {
        return [BigInt(id)];
      } catch {
        return [];
      }
    });
    if (bigIds.length) {
      const stickers = await prisma.sticker.findMany({
        where: { id: { in: bigIds } },
      });
      const order = new Map(bigIds.map((id, i) => [id.toString(), i]));
      stickers.sort(
        (a, b) =>
          (order.get(a.id.toString()) ?? 0) - (order.get(b.id.toString()) ?? 0),
      );
      initial = stickers.map((s) => ({
        id: s.id.toString(),
        title: s.title,
        slug: s.slug,
        visibility: s.visibility,
        thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
        fullUrl: `/api/stickers/${s.id}/media/image`,
      }));
    }
  } else if (sp.collection) {
    const col = await prisma.collection.findUnique({
      where: { slug: sp.collection },
      include: {
        items: {
          where: { subjectType: "sticker" },
          orderBy: { sortOrder: "asc" },
          take: MAX_SHEET_STICKERS,
        },
      },
    });
    if (col) {
      const stickers = await prisma.sticker.findMany({
        where: { id: { in: col.items.map((i) => i.subjectId) } },
      });
      const map = new Map(stickers.map((s) => [s.id.toString(), s]));
      initial = col.items
        .map((i) => map.get(i.subjectId.toString()))
        .filter(Boolean)
        .map((s) => ({
          id: s!.id.toString(),
          title: s!.title,
          slug: s!.slug,
          visibility: s!.visibility ?? VISIBILITY.public,
          thumbUrl: `/api/stickers/${s!.id}/media/thumbnail`,
          fullUrl: `/api/stickers/${s!.id}/media/image`,
        }));
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm">
        <Link href="/prints" className="text-accent-pink hover:underline">
          ← Prints
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        new sticker sheet
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Max {MAX_SHEET_STICKERS} stickers. Sheet is always public after you save.
      </p>
      <div className="mt-8">
        <CreateSheetForm
          initialStickers={initial}
          requirePickerFirst={initial.length === 0}
        />
      </div>
    </section>
  );
}
