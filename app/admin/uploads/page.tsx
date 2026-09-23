import { requireAdmin } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { AdminUploadsList } from "@/components/admin-uploads-list";
import Link from "next/link";

export default async function AdminUploadsPage() {
  await requireAdmin();

  const uploads = await prisma.glassUpload.findMany({
    where: { status: { in: ["pending", "approved"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { username: true } } },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <p className="text-sm">
        <Link href="/admin/users" className="text-accent-pink hover:underline">
          ← Users
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Glass uploads
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Approve moves the object from the user&apos;s private prism to the
        public prism.
      </p>
      <div className="mt-10 max-w-3xl">
        <AdminUploadsList
          uploads={uploads.map((u) => ({
            id: u.id.toString(),
            title: u.title,
            size: u.size,
            status: u.status,
            username: u.user.username,
            createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>
    </section>
  );
}
