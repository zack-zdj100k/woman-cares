import type { MetadataRoute } from "next";

const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Search engines may read the public pages; private areas and the API are off limits. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/uploads/", "/fr/dashboard/", "/ar/dashboard/", "/fr/auth/", "/ar/auth/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
