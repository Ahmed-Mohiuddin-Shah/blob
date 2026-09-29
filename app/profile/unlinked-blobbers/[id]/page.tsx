import Link from "next/link";
import { notFound } from "next/navigation";
import { UnlinkedBlobberEditForm } from "@/components/unlinked-blobber-edit-form";
import { liveCmsSnapshot } from "@/lib/blobbers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export default async function UnlinkedBlobberEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  let blobberId: bigint;
  try {
    blobberId = BigInt(id);
  } catch {
    notFound();
  }

  const blobber = await prisma.blobber.findUnique({
    where: { id: blobberId },
    include: { socialLinks: { include: { socialLink: true } } },
  });
  if (!blobber || blobber.userId != null) notFound();

  return (
    <div>
      <p className="text-sm">
        <Link
          href="/profile/unlinked-blobbers"
          className="text-accent-pink hover:underline"
        >
          ← Unlinked Blobbers
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Edit {blobber.displayName}
      </h1>
      <div className="mt-8">
        <UnlinkedBlobberEditForm
          blobberId={blobber.id.toString()}
          slug={blobber.slug}
          initial={liveCmsSnapshot(blobber)}
        />
      </div>
    </div>
  );
}
