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

/**
 * Page security headers. The API and /uploads routes set their own (stricter, per file type),
 * so they are excluded rather than given two conflicting policies.
 *
 * Fonts are self-hosted by next/font and no third-party script is loaded, so the policy can be
 * tight. 'unsafe-inline' stays for scripts and styles because Next's bootstrap and the motion
 * libraries write inline; 'unsafe-eval' is development only (the dev overlay needs it).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' blob: https://res.cloudinary.com",
  "connect-src 'self' https://res.cloudinary.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Distance search asks for the visitor's position, so geolocation stays available to this site.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: remoteMedia },
  async headers() {
    return [{ source: "/((?!api/|uploads/).*)", headers: securityHeaders }];
  },
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
