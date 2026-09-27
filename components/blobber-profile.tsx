"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { blobberMediaUrl } from "@/lib/blobber-media-url";
import { StickerCard, type StickerCardProps } from "./sticker-card";
import { UserBlobatar } from "./user-blobatar";

type Social = { linkType: string; handle: string; url: string };

type Profile = {
  id: string;
  displayName: string;
  description: string | null;
  bannerGlassObjectId: string | null;
  avatarGlassObjectId: string | null;
  showStickers: boolean;
  showCollections: boolean;
  showStickerSheets: boolean;
  socialLinks: Social[];
  username: string | null;
};

type Section = "stickers" | "collections" | "sheets";

export function BlobberProfile({ profile }: { profile: Profile }) {
  const sections = (
    [
      profile.showStickers ? "stickers" : null,
      profile.showCollections ? "collections" : null,
      profile.showStickerSheets ? "sheets" : null,
    ] as const
  ).filter(Boolean) as Section[];

  const [section, setSection] = useState<Section>(sections[0] ?? "stickers");
  const [items, setItems] = useState<StickerCardProps[]>([]);
  const [extra, setExtra] = useState<
    Array<{ id: string; title: string; href: string; thumbUrl?: string | null }>
  >([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const endpoint =
    section === "stickers"
      ? `/api/blobbers/${profile.id}/stickers`
      : section === "collections"
        ? `/api/blobbers/${profile.id}/collections`
        : `/api/blobbers/${profile.id}/sheets`;

  const fetchPage = useCallback(
    async (nextCursor: string | null, replace: boolean) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      const res = await fetch(`${endpoint}?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as {
        items: Array<Record<string, unknown>>;
        nextCursor: string | null;
      };
      if (section === "stickers") {
        const mapped = json.items as unknown as StickerCardProps[];
        setItems((prev) => (replace ? mapped : [...prev, ...mapped]));
        setExtra([]);
      } else {
        setExtra((prev) =>
          replace
            ? (json.items as typeof extra)
            : [...prev, ...(json.items as typeof extra)],
        );
        setItems([]);
      }
      setCursor(json.nextCursor);
    },
    [endpoint, section],
  );

  useEffect(() => {
    setLoading(true);
    fetchPage(null, true)
      .catch(() => {
        setItems([]);
        setExtra([]);
      })
      .finally(() => setLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchPage(cursor, false);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, fetchPage]);

  const bannerUrl = blobberMediaUrl(profile.bannerGlassObjectId);
  const avatarUrl = blobberMediaUrl(profile.avatarGlassObjectId);

  return (
    <div>
      <div className="relative overflow-hidden rounded-[2rem] border border-divider bg-surface">
        <div
          className="h-36 bg-accent-gradient sm:h-48"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="relative px-5 pb-6 pt-0 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-badge shadow-md">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserBlobatar
                  username={profile.username || profile.displayName}
                  size={96}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-xs font-bold uppercase tracking-wider text-inactive">
                Blobber
              </p>
              <h1 className="truncate text-3xl font-light lowercase tracking-tight sm:text-4xl">
                {profile.displayName}
              </h1>
            </div>
          </div>
          {profile.description ? (
            <p className="mt-4 max-w-2xl text-sm text-secondary">
              {profile.description}
            </p>
          ) : null}
          {profile.socialLinks.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {profile.socialLinks.map((s) => (
                <li key={`${s.linkType}-${s.url}`}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-badge px-3 py-1.5 text-xs font-semibold text-foreground transition hover:text-accent-pink"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-white">
                      <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="uppercase text-[10px] text-inactive">
                      {s.linkType}
                    </span>
                    {s.handle}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {sections.length ? (
        <div className="sticky top-0 z-10 mt-8 border-b border-divider bg-background/95 py-3 backdrop-blur-md">
          <div className="flex gap-2 overflow-x-auto">
            {sections.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                  section === s
                    ? "bg-accent-gradient text-white"
                    : "bg-badge text-secondary hover:text-foreground"
                }`}
              >
                {s === "sheets" ? "Sticker sheets" : s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : section === "stickers" ? (
          items.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <StickerCard key={item.href} {...item} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary">No stickers yet.</p>
          )
        ) : extra.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {extra.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-[1.5rem] border border-divider bg-surface p-3 transition hover:border-accent-pink/40"
                >
                  {item.thumbUrl ? (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-badge">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <span className="truncate font-semibold">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-secondary">Nothing here yet.</p>
        )}
        <div ref={loadMoreRef} className="h-8" />
      </div>
    </div>
  );
}
