"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FavoriteUiType } from "@/lib/favorites";
import { BusyButton } from "./busy-button";

type Props = {
  subjectType: FavoriteUiType;
  subjectId: string;
  initialFavourited?: boolean;
  signedIn: boolean;
  signInHref?: string;
  /** Compact circular control (card overlay) vs pill (detail). */
  variant?: "icon" | "pill";
  className?: string;
};

export function FavouriteButton({
  subjectType,
  subjectId,
  initialFavourited = false,
  signedIn,
  signInHref = "/auth/login",
  variant = "icon",
  className = "",
}: Props) {
  const router = useRouter();
  const [favourited, setFavourited] = useState(initialFavourited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push(signInHref);
      return;
    }
    setBusy(true);
    const next = !favourited;
    setFavourited(next);
    try {
      const res = await fetch("/api/favourites", {
        method: next ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId }),
      });
      if (!res.ok) setFavourited(!next);
    } catch {
      setFavourited(!next);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "pill") {
    return (
      <BusyButton
        type="button"
        busy={busy}
        onClick={() => void toggle()}
        className={`inline-flex items-center gap-2 rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40 ${className}`}
        aria-pressed={favourited}
        title={favourited ? "Remove favourite" : "Add to favourites"}
      >
        <Heart
          className="h-4 w-4"
          strokeWidth={1.75}
          fill={favourited ? "currentColor" : "none"}
          aria-hidden
        />
        {favourited ? "Favourited" : "Favourite"}
      </BusyButton>
    );
  }

  return (
    <BusyButton
      type="button"
      busy={busy}
      onClick={() => void toggle()}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-badge text-foreground shadow-lg transition hover:scale-105 ${
        favourited ? "text-accent-pink" : ""
      } ${className}`}
      aria-pressed={favourited}
      aria-label={favourited ? "Remove favourite" : "Add to favourites"}
      title={favourited ? "Remove favourite" : "Favourite"}
    >
      <Heart
        className="h-5 w-5"
        strokeWidth={1.75}
        fill={favourited ? "currentColor" : "none"}
        aria-hidden
      />
    </BusyButton>
  );
}
