import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BLOB Sticker Library",
    short_name: "BLOB",
    description: "A public sticker library — find something sticky.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#f10ea0",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
