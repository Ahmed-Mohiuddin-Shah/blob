import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["blob-editor"],
  serverExternalPackages: [
    "@napi-rs/canvas",
    "ffmpeg-static",
    "gifenc",
    "pdf-lib",
  ],
  // Prompt-manager visual tests send GIF/video base64 via server actions.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
