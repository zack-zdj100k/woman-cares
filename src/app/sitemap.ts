import type { MetadataRoute } from "next";
import { categorySlugs } from "@/config/categories";
import { DEMO_SLUG_PREFIX } from "@/config/demo";
import { locales } from "@/i18n/config";
import { db } from "@/lib/db";

const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Public pages in both languages, plus every published profile. Demo businesses are left out:
 * they are invented, and their pages are noindex anyway.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/about-platform", "/about-services", "/contact", "/legal/privacy", "/legal/terms", ...categorySlugs.map((s) => `/${s}`)];
  const entries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    pages.map((path) => ({ url: `${base}/${locale}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.7 })),
  );

  try {
    const profiles = await db.providerServiceProfile.findMany({
      where: { status: "PUBLISHED", NOT: { slug: { startsWith: DEMO_SLUG_PREFIX } } },
      select: { slug: true, updatedAt: true },
      take: 5000,
    });
    for (const p of profiles) {
      for (const locale of locales) {
        entries.push({ url: `${base}/${locale}/profiles/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.8 });
      }
    }
  } catch {
    // The sitemap must never break a build or a request because the database is briefly unreachable.
  }
  return entries;
}
