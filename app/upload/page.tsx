import { redirect } from "next/navigation";
import { StickerCreateForm } from "@/components/sticker-create-form";
import { canUpload } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

export default async function UploadPage() {
  const { user } = await requireSessionUser();
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    redirect("/profile");
  }

  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
          Contribute
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Create a sticker
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Compose in the editor, then submit for review. Framing and cutouts live
          in the composition document.
        </p>
      </div>
      <div className="mt-10">
        <StickerCreateForm
          categories={categories.map((c) => ({
            id: c.id.toString(),
            name: c.name,
            slug: c.slug,
          }))}
        />
      </div>
    </section>
  );
}
