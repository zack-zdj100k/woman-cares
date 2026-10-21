import type { NextConfig } from "next";

// When media move to a CDN or bucket (PUBLIC_MEDIA_BASE_URL=https://…, or Cloudinary), allow
// next/image to optimise them. The cloud name is public; the key and secret never reach this file.
const mediaBase = process.env.PUBLIC_MEDIA_BASE_URL;
const cloudName = (() => {
  try {
    return process.env.STORAGE_DRIVER === "cloudinary" && process.env.CLOUDINARY_URL
      ? new URL(process.env.CLOUDINARY_URL).hostname
      : null;
  } catch {
    return null;
  }
})();
const remoteMedia = [
  ...(mediaBase?.startsWith("http") ? [new URL(`${mediaBase.replace(/\/$/, "")}/**`)] : []),
  ...(cloudName ? [new URL(`https://res.cloudinary.com/${cloudName}/**`)] : []),
];

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
