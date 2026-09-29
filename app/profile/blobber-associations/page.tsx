import { BlobberAssociationRequestsList } from "@/components/blobber-association-requests-list";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export default async function ProfileBlobberAssociationsPage() {
  await requireAdmin();

  const rows = await prisma.blobberAssociationRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      targetBlobber: { select: { id: true, displayName: true, slug: true } },
      requester: { select: { username: true, displayName: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Blobber associations
      </h1>
      <p className="mt-1 text-sm text-secondary">
        Approve moves the member onto the target Blobber and re-points their stickers.
      </p>
      <div className="mt-8">
        <BlobberAssociationRequestsList
          items={rows.map((r) => ({
            id: r.id.toString(),
            status: r.status,
            message: r.message,
            createdAt: r.createdAt.toISOString(),
            targetBlobber: {
              id: r.targetBlobber.id.toString(),
              displayName: r.targetBlobber.displayName,
              slug: r.targetBlobber.slug,
            },
            requester: r.requester,
          }))}
        />
      </div>
    </div>
  );
}
