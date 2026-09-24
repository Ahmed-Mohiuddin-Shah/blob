import Link from "next/link";
import { StickerMedia } from "@/components/sticker-media";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
}

export default async function ProfileEditsPage() {
  const { user } = await requireSessionUser();

  const stickers = await prisma.sticker.findMany({
    where: {
      moderationStatus: "needs_edit",
      uploadedById: user.id,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      media: { select: { kind: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit requests</h1>
      <p className="mt-1 text-sm text-secondary">
        Admins asked for changes. Update metadata and resubmit for approval.
      </p>

      {stickers.length === 0 ? (
        <p className="mt-10 py-6 text-center text-sm text-secondary">
          No pending edit requests.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {stickers.map((s) => {
            const type = typeFromMedia(s.media.map((m) => m.kind));
            return (
              <li
                key={s.id.toString()}
                className="flex flex-col gap-4 rounded-[1.5rem] border border-divider bg-surface p-4 sm:flex-row sm:items-center"
              >
                <Link
                  href={`/stickers/${s.slug}/edit`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl"
                >
                  <StickerMedia
                    src={`/api/stickers/${s.id}/media/thumbnail`}
                    seed={s.title}
                    alt={s.title}
                    video={type === "VIDEO"}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-xs text-secondary">
                    {type} · needs edit
                  </p>
                  {s.moderationNote ? (
                    <p className="mt-2 text-sm text-accent-orange">
                      {s.moderationNote}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/stickers/${s.slug}/edit`}
                  className="rounded-full bg-accent-gradient px-4 py-2 text-center text-xs font-semibold text-white"
                >
                  Edit
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
