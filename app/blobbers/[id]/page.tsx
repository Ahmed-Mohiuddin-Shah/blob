import { notFound } from "next/navigation";
import { BlobberProfile } from "@/components/blobber-profile";
import { liveCmsSnapshot } from "@/lib/blobbers";
import { prisma } from "@/lib/prisma";

export default async function BlobberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let blobberId: bigint;
  try {
    blobberId = BigInt(id);
  } catch {
    notFound();
  }

  const blobber = await prisma.blobber.findUnique({
    where: { id: blobberId },
    include: {
      user: { select: { username: true } },
      socialLinks: { include: { socialLink: true } },
    },
  });
  if (!blobber) notFound();

  const live = liveCmsSnapshot(blobber);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <BlobberProfile
        profile={{
          id: blobber.id.toString(),
          ...live,
          username: blobber.user?.username ?? null,
        }}
      />
    </section>
  );
}
