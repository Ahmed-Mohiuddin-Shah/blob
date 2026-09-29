"use client";

import { useState } from "react";

type Props = {
  src: string | null;
  seed: string;
  alt: string;
  className?: string;
  video?: boolean;
  /** Above-fold: eager + high fetch priority. */
  priority?: boolean;
};

/** Pulse under media until it paints; image always stacks above (z-10). */
export function StickerMedia({
  src,
  seed: _seed,
  alt,
  className = "",
  video,
  priority = false,
}: Props) {
  // Track which src has painted — survives remount/cache where onLoad may not re-fire.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = !!src && loadedSrc === src;

  const noteLoaded = (el: HTMLImageElement | HTMLVideoElement | null) => {
    if (!src || !el) return;
    if (el instanceof HTMLImageElement) {
      if (el.complete && el.naturalWidth > 0) setLoadedSrc(src);
      return;
    }
    if (el.readyState >= 2) setLoadedSrc(src);
  };

  return (
    <div
      className={`relative aspect-square overflow-hidden bg-badge ${className}`}
    >
      {!loaded || !src ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 animate-pulse bg-badge"
          aria-hidden
        />
      ) : null}
      {src ? (
        video ? (
          <video
            key={src}
            ref={noteLoaded}
            src={src}
            muted
            playsInline
            loop
            autoPlay
            className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoadedData={() => setLoadedSrc(src)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            ref={noteLoaded}
            src={src}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoadedSrc(src)}
          />
        )
      ) : null}
    </div>
  );
}
