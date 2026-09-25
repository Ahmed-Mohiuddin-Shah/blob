import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["blob-editor"],
  serverExternalPackages: [
    "@napi-rs/canvas",
    "ffmpeg-static",
    "gifenc",
  ],
};

export default nextConfig;
