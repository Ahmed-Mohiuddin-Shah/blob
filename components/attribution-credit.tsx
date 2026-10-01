"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { useId, useState } from "react";

export type AttributionCreditProps = {
  /** Credit label (blobber display name). Empty = hide credit line. */
  label: string;
  sourceUrl?: string | null;
  /** Internal Blobber profile path. */
  blobberHref?: string | null;
  /** Show info icon + popover when source/attribution exists. */
  showInfo?: boolean;
  className?: string;
};

export function AttributionCredit({
  label,
  sourceUrl,
  blobberHref,
  showInfo,
  className = "",
}: AttributionCreditProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  if (!label) return null;

  const profileHref = blobberHref || null;
  const hasSource = !!sourceUrl;
  const showInfoBtn = !!showInfo && hasSource;

  const nameEl = profileHref ? (
    <Link
      href={profileHref}
      className="font-medium text-accent-pink hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  ) : (
    <span className="font-medium text-secondary">{label}</span>
  );

  function goToSource(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (sourceUrl) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <span className={`relative inline-flex max-w-full items-center gap-1.5 ${className}`}>
      <span className="truncate text-xs text-secondary">
        by {nameEl}
      </span>

      {showInfoBtn ? (
        <span className="relative shrink-0">
          <button
            type="button"
            aria-label="Attribution info"
            aria-expanded={open}
            aria-controls={tipId}
            onClick={goToSource}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-gradient text-white shadow-sm">
              <Info className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </span>
          </button>
          {open ? (
            <span
              id={tipId}
              role="tooltip"
              className="absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-2xl border border-divider bg-surface px-3 py-2 text-[11px] leading-snug text-secondary shadow-lg"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              <span className="block font-semibold text-foreground">{label}</span>
              <span className="mt-1 block truncate text-accent-pink">
                {sourceUrl}
              </span>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
