import type { NextConfig } from "next";

// When media move to a CDN or bucket (PUBLIC_MEDIA_BASE_URL=https://…), allow next/image to optimise them.
const mediaBase = process.env.PUBLIC_MEDIA_BASE_URL;
const remoteMedia = mediaBase?.startsWith("http") ? [new URL(`${mediaBase.replace(/\/$/, "")}/**`)] : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: remoteMedia },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
