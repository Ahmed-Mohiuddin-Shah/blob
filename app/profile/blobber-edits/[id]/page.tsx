import Link from "next/link";
import { notFound } from "next/navigation";
import { BlobberEditReviewActions } from "@/components/blobber-edit-review-actions";
import { parseCmsPayload } from "@/lib/blobbers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export default async function BlobberEditReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  let editId: bigint;
  try {
    editId = BigInt(id);
  } catch {
    notFound();
  }

  const editReq = await prisma.blobberEditRequest.findUnique({
    where: { id: editId },
    include: {
      blobber: { select: { id: true, displayName: true } },
      requester: { select: { username: true, displayName: true } },
    },
  });
  if (!editReq) notFound();

  const proposed = parseCmsPayload(editReq.proposedPayload);
  if ("error" in proposed) notFound();

  const blobberId = editReq.blobber.id.toString();
  const liveSrc = `/blobbers/${blobberId}`;
  const proposedSrc = `/blobbers/${blobberId}/preview/${editReq.id}`;

  return (
    <div>
      <p className="text-sm">
        <Link
          href="/profile/blobber-edits"
          className="text-accent-pink hover:underline"
        >
          ← Blobber edits
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Review profile update
      </h1>
      <p className="mt-1 text-sm text-secondary">
        <Link
          href={liveSrc}
          className="font-semibold text-accent-pink hover:underline"
        >
          {editReq.blobber.displayName}
        </Link>
        {" · "}
        by {editReq.requester.displayName || editReq.requester.username}
        {" · "}
        {new Date(editReq.createdAt).toLocaleString()}
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-inactive">
            Live (public)
          </p>
          <div className="overflow-hidden rounded-[1.5rem] border border-divider bg-surface">
            <iframe
              title="Live Blobber profile"
              src={liveSrc}
              className="h-[70vh] w-full bg-background"
            />
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent-orange">
            Proposed
          </p>
          <div className="overflow-hidden rounded-[1.5rem] border border-accent-orange/40 bg-surface">
            <iframe
              title="Proposed Blobber profile"
              src={proposedSrc}
              className="h-[70vh] w-full bg-background"
            />
          </div>
        </div>
      </div>

      {editReq.status === "pending" ? (
        <div className="mt-8">
          <BlobberEditReviewActions requestId={editReq.id.toString()} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-secondary">
          Status: {editReq.status}
          {editReq.adminNote ? ` — ${editReq.adminNote}` : ""}
        </p>
      )}
    </div>
  );
}
