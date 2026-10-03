"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

type Props = {
  src: string | null;
  seed: string;
  alt: string;
  className?: string;
  video?: boolean;
  /** Above-fold: eager + high fetch priority. */
  priority?: boolean;
  /** Detail page: show unmute control when the mp4 has audio. Default muted. */
  soundToggle?: boolean;
};

/** Pulse under media until it paints; image always stacks above (z-10). */
export function StickerMedia({
  src,
  seed: _seed,
  alt,
  className = "",
  video,
  priority = false,
  soundToggle = false,
}: Props) {
  // Track which src has painted — survives remount/cache where onLoad may not re-fire.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const loaded = !!src && loadedSrc === src;
  const failed = !!src && failedSrc === src;

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
      {!loaded && !failed ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 animate-pulse bg-badge"
          aria-hidden
        />
      ) : null}
      {src ? (
        video ? (
          <>
            <video
              key={src}
              ref={noteLoaded}
              src={src}
              muted={muted}
              playsInline
              loop
              autoPlay
              className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
              onLoadedData={() => setLoadedSrc(src)}
              onError={() => setFailedSrc(src)}
            />
            {soundToggle ? (
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-badge text-foreground shadow-sm"
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            ) : null}
          </>
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
            onError={() => setFailedSrc(src)}
          />
        )
      ) : null}
    </div>
  );
}
