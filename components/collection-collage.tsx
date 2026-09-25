"use client";

import { Layers } from "lucide-react";
import { useMemo } from "react";

type Props = {
  urls: string[];
  seed: string;
  alt: string;
};

/** Seeded shuffle so SSR + client match. */
function shuffleSeeded(urls: string[], seed: string): string[] {
  const out = urls.slice(0, 5);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    const j = Math.floor(((h >>> 0) / 4294967296) * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function gridClass(n: number): string {
  if (n <= 1) return "grid-cols-1 grid-rows-1";
  if (n === 2) return "grid-cols-2 grid-rows-1";
  if (n === 3) {
    return "grid-cols-2 grid-rows-2 [&>:first-child]:row-span-2";
  }
  if (n === 4) return "grid-cols-2 grid-rows-2";
  // 5: 2 on top (half each), 3 on bottom
  return "grid-cols-6 grid-rows-2 [&>:nth-child(1)]:col-span-3 [&>:nth-child(2)]:col-span-3 [&>:nth-child(3)]:col-span-2 [&>:nth-child(4)]:col-span-2 [&>:nth-child(5)]:col-span-2";
}

/** Square collage of up to five sticker thumbs (order randomized by seed). */
export function CollectionCollage({ urls, seed, alt }: Props) {
  const tiles = useMemo(() => shuffleSeeded(urls, seed), [urls, seed]);

  if (tiles.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-gradient text-white shadow-md shadow-accent-pink/20">
          <Layers className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className={`grid h-full w-full gap-0.5 bg-divider ${gridClass(tiles.length)}`}>
      {tiles.map((src, i) => (
        <div key={`${src}-${i}`} className="min-h-0 min-w-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={i === 0 ? alt : ""}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
