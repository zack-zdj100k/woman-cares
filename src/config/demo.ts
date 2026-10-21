/**
 * Demo businesses seeded for development (prisma/seed-demo.ts) use this slug prefix. They are
 * invented, so they must never be indexed by search engines; when real professionals replace
 * them the prefix disappears and the pages become indexable on their own.
 */
export const DEMO_SLUG_PREFIX = "demo-";

export function isDemoSlug(slug: string) {
  return slug.startsWith(DEMO_SLUG_PREFIX);
}
