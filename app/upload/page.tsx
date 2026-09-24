import { redirect } from "next/navigation";
import { StickerUploadForm } from "@/components/sticker-upload-form";
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
          Upload a sticker
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Simple upload for now — editor comes later. Submissions go to pending review.
        </p>
      </div>
      <div className="mt-10">
        <StickerUploadForm
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
