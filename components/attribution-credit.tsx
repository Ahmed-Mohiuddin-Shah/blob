"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

export type AttributionCreditProps = {
  /** Credit label (authorName) or uploader fallback. */
  label: string;
  sourceUrl?: string | null;
  /** Show info icon + popover when source/attribution exists. */
  showInfo?: boolean;
  className?: string;
};

export function AttributionCredit({
  label,
  sourceUrl,
  showInfo,
  className = "",
}: AttributionCreditProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const hasSource = !!sourceUrl;

  return (
    <span className={`relative inline-flex max-w-full items-center gap-1.5 ${className}`}>
      <span className="truncate text-xs text-secondary">
        by{" "}
        {hasSource ? (
          <a
            href={sourceUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent-pink hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </a>
        ) : (
          <span className="font-medium text-secondary">{label}</span>
        )}
      </span>

      {showInfo && hasSource ? (
        <span className="relative shrink-0">
          <button
            type="button"
            aria-label="Attribution info"
            aria-expanded={open}
            aria-controls={tipId}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-gradient text-white shadow-sm"
          >
            <Info className="h-3 w-3" strokeWidth={1.75} aria-hidden />
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
              <a
                href={sourceUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-accent-pink hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {sourceUrl}
              </a>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
