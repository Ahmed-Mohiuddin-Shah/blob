"use client";

import { useState } from "react";
import { Skeleton } from "./skeleton";

type Props = {
  src: string | null;
  seed: string;
  alt: string;
  className?: string;
  video?: boolean;
  /** Above-fold: eager + high fetch priority. */
  priority?: boolean;
};

/** Skeleton until media finishes loading; keeps aspect-square reserved. */
export function StickerMedia({
  src,
  seed: _seed,
  alt,
  className = "",
  video,
  priority = false,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative aspect-square overflow-hidden ${className}`}>
      {!loaded || !src ? (
        <div className="pointer-events-none absolute inset-0 leading-none">
          <Skeleton
            className="!rounded-none"
            height="100%"
            width="100%"
            containerClassName="block h-full w-full leading-none"
          />
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
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
          />
        )
      ) : null}
    </div>
  );
}
