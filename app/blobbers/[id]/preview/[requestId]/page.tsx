import { notFound } from "next/navigation";
import { BlobberProfile } from "@/components/blobber-profile";
import { parseCmsPayload } from "@/lib/blobbers";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

/** Admin-only proposed CMS preview for iframe embeds. */
export default async function BlobberEditPreviewPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>;
}) {
  const { user } = await requireSessionUser();
  if (!canModerate({ role: user.role, accountStatus: user.accountStatus })) {
    notFound();
  }

  const { id, requestId } = await params;
  let blobberId: bigint;
  let editId: bigint;
  try {
    blobberId = BigInt(id);
    editId = BigInt(requestId);
  } catch {
    notFound();
  }

  const editReq = await prisma.blobberEditRequest.findUnique({
    where: { id: editId },
    include: {
      blobber: {
        include: { user: { select: { username: true } } },
      },
    },
  });
  if (!editReq || editReq.blobberId !== blobberId) notFound();

  const proposed = parseCmsPayload(editReq.proposedPayload);
  if ("error" in proposed) notFound();

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-wider text-accent-orange">
        Proposed preview — not live
      </p>
      <BlobberProfile
        profile={{
          id: editReq.blobber.id.toString(),
          ...proposed,
          username: editReq.blobber.user?.username ?? null,
        }}
      />
    </section>
  );
}
