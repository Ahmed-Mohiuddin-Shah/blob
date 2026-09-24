"use client";

import { useState } from "react";
import { Blobatar } from "@blobatar/react";

type Props = {
  src: string | null;
  seed: string;
  alt: string;
  className?: string;
  video?: boolean;
};

/** Shows blobatar(seed) until the media finishes loading. */
export function StickerMedia({ src, seed, alt, className = "", video }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative aspect-square overflow-hidden ${className}`}>
      {!loaded || !src ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface">
          <Blobatar name={seed || "sticker"} size={96} animate="hover" />
        </div>
      ) : null}
      {src ? (
        video ? (
          <video
            src={src}
            muted
            playsInline
            loop
            autoPlay
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoadedData={() => setLoaded(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
          />
        )
      ) : null}
    </div>
  );
}
