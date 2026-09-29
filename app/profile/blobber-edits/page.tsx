import { BlobberEditRequestsList } from "@/components/blobber-edit-requests-list";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export default async function ProfileBlobberEditsPage() {
  await requireAdmin();

  const rows = await prisma.blobberEditRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      blobber: { select: { id: true, displayName: true, slug: true } },
      requester: { select: { username: true, displayName: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Blobber profile edits</h1>
      <p className="mt-1 text-sm text-secondary">
        Open a request to compare live vs proposed embedded profile previews.
      </p>
      <div className="mt-8">
        <BlobberEditRequestsList
          items={rows.map((r) => ({
            id: r.id.toString(),
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            blobber: {
              id: r.blobber.id.toString(),
              displayName: r.blobber.displayName,
            },
            requester: r.requester,
          }))}
        />
      </div>
    </div>
  );
}
