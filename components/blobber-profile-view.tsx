import { BlobberProfile } from "@/components/blobber-profile";
import { liveCmsSnapshot } from "@/lib/blobbers";

type BlobberRow = {
  id: bigint;
  displayName: string;
  description: string | null;
  bannerGlassObjectId: string | null;
  avatarGlassObjectId: string | null;
  showStickers: boolean;
  showCollections: boolean;
  showStickerSheets: boolean;
  socialLinks: Array<{
    socialLink: { linkType: string; handle: string; url: string };
  }>;
  user: { username: string } | null;
};

export function BlobberProfileView({ blobber }: { blobber: BlobberRow }) {
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
