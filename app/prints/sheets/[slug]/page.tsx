import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AddToCollectionButton } from "@/components/add-to-collection-button";
import { FavouriteButton } from "@/components/favourite-button";
import { PrintDownloadButtons } from "@/components/print-download-buttons";
import { PrintStickersInfiniteGrid } from "@/components/print-stickers-infinite-grid";
import { getSession, signInUrl } from "@/lib/auth";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";

export default async function SheetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sheet = await prisma.stickerSheet.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      stickers: { select: { stickerId: true } },
    },
  });
  if (!sheet) notFound();

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  const viewerId = session?.user?.id ? BigInt(session.user.id) : null;
  const isCreator = viewerId === sheet.createdById;

  if (sheet.status !== PRINT_STATUS.ready && !isCreator) {
    notFound();
  }

  let favourited = false;
  if (viewerId) {
    const fav = await prisma.favorite.findUnique({
      where: {
        userId_subjectType_subjectId: {
          userId: viewerId,
          subjectType: FAVORITE_SUBJECT.stickerSheet,
          subjectId: sheet.id,
        },
      },
    });
    favourited = !!fav;
  }

  const signInHref = signInUrl({
    redirectTo: `/prints/sheets/${sheet.slug}`,
  });
  const ready = sheet.status === PRINT_STATUS.ready;

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm">
        <Link href="/prints" className="text-accent-pink hover:underline">
          ← Prints
        </Link>
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-[2rem] border border-divider bg-badge">
          {ready && sheet.pngGlassObjectId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/sheets/${sheet.id}/media/png`}
              alt={sheet.name}
              className="w-full object-contain"
            />
          ) : (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="h-24 w-24 animate-pulse rounded-[2rem] bg-surface" />
              <p className="text-sm text-secondary">
                {sheet.status === PRINT_STATUS.failed
                  ? sheet.errorMessage ?? "Encode failed"
                  : "Generating sheet…"}
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-pink">
            Sticker sheet
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {sheet.name}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            by {sheet.createdBy.displayName || sheet.createdBy.username} ·{" "}
            {sheet.stickers.length} stickers · {sheet.status}
          </p>
          {sheet.description ? (
            <p className="mt-4 text-sm leading-6">{sheet.description}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <FavouriteButton
              subjectType={FAVORITE_SUBJECT.stickerSheet}
              subjectId={sheet.id.toString()}
              initialFavourited={favourited}
              signedIn={!!viewerId}
              signInHref={signInHref}
              variant="pill"
            />
            <AddToCollectionButton
              subjectType={FAVORITE_SUBJECT.stickerSheet}
              subjectId={sheet.id.toString()}
              signedIn={!!viewerId}
              signInHref={signInHref}
              variant="pill"
            />
          </div>

          <PrintDownloadButtons
            id={sheet.id.toString()}
            slug={sheet.slug}
            kind="sheets"
            pngGlassObjectId={sheet.pngGlassObjectId}
            pdfGlassObjectId={sheet.pdfGlassObjectId}
            ready={ready}
          />
        </div>
      </div>

      <PrintStickersInfiniteGrid
        endpoint={`/api/sheets/${sheet.id}/stickers`}
        title="Stickers on this sheet"
      />
    </section>
  );
}
