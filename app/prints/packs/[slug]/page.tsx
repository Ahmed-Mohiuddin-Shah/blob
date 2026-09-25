import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AddToCollectionButton } from "@/components/add-to-collection-button";
import { FavouriteButton } from "@/components/favourite-button";
import { PrintDownloadButtons } from "@/components/print-download-buttons";
import { PrintFailedActions } from "@/components/print-failed-actions";
import { PrintPendingRefresh } from "@/components/print-pending-refresh";
import { PrintStickersInfiniteGrid } from "@/components/print-stickers-infinite-grid";
import { getSession, signInUrl } from "@/lib/auth";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { enqueuePackEncode } from "@/lib/print-encode";
import { PRINT_STATUS, serializeSheet } from "@/lib/prints";
import { prisma } from "@/lib/prisma";

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = await prisma.stickerPack.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      sheets: {
        orderBy: { sortOrder: "asc" },
        include: {
          sheet: {
            include: {
              createdBy: { select: { username: true, displayName: true } },
              stickers: { select: { stickerId: true } },
            },
          },
        },
      },
    },
  });
  if (!pack) notFound();

  if (pack.status === PRINT_STATUS.pending) {
    enqueuePackEncode(pack.id);
  }

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  const viewerId = session?.user?.id ? BigInt(session.user.id) : null;
  const isCreator = viewerId === pack.createdById;

  if (pack.status !== PRINT_STATUS.ready && !isCreator) {
    notFound();
  }

  let favourited = false;
  if (viewerId) {
    const fav = await prisma.favorite.findUnique({
      where: {
        userId_subjectType_subjectId: {
          userId: viewerId,
          subjectType: FAVORITE_SUBJECT.stickerPack,
          subjectId: pack.id,
        },
      },
    });
    favourited = !!fav;
  }

  const signInHref = signInUrl({
    redirectTo: `/prints/packs/${pack.slug}`,
  });
  const ready = pack.status === PRINT_STATUS.ready;

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <PrintPendingRefresh active={pack.status === PRINT_STATUS.pending} />
      <p className="text-sm">
        <Link href="/prints" className="text-accent-pink hover:underline">
          ← Prints
        </Link>
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-[2rem] border border-divider bg-badge">
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/packs/${pack.id}/media/png`}
              alt={pack.name}
              className="w-full object-contain"
            />
          ) : (
            <div className="flex aspect-square flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="h-24 w-24 animate-pulse rounded-[2rem] bg-surface" />
              <p className="text-sm text-secondary">
                {pack.status === PRINT_STATUS.failed
                  ? pack.errorMessage ?? "Encode failed"
                  : "Generating pack…"}
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-pink">
            Sticker pack
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {pack.name}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            by {pack.createdBy.displayName || pack.createdBy.username} ·{" "}
            {pack.sheets.length} sheets · {pack.status}
          </p>
          {pack.description ? (
            <p className="mt-4 text-sm leading-6">{pack.description}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <FavouriteButton
              subjectType={FAVORITE_SUBJECT.stickerPack}
              subjectId={pack.id.toString()}
              initialFavourited={favourited}
              initialLikesCount={Number(pack.likesCount)}
              signedIn={!!viewerId}
              signInHref={signInHref}
              variant="pill"
            />
            <AddToCollectionButton
              subjectType={FAVORITE_SUBJECT.stickerPack}
              subjectId={pack.id.toString()}
              signedIn={!!viewerId}
              signInHref={signInHref}
              variant="pill"
            />
          </div>

          <PrintDownloadButtons
            id={pack.id.toString()}
            slug={pack.slug}
            kind="packs"
            ready={ready}
          />

          {isCreator && pack.status === PRINT_STATUS.failed ? (
            <PrintFailedActions kind="packs" id={pack.id.toString()} />
          ) : null}

          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
              Sheets in this pack
            </p>
            <ul className="mt-3 space-y-2">
              {pack.sheets.map(({ sheet }) => {
                const s = serializeSheet(sheet);
                return (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className="text-sm font-semibold text-accent-pink hover:underline"
                    >
                      {s.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <PrintStickersInfiniteGrid
        endpoint={`/api/packs/${pack.id}/stickers`}
        title="Stickers in this pack"
      />
    </section>
  );
}
