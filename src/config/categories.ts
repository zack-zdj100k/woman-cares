/**
 * Static presentation data for the six launch categories.
 * The database `Category` table is the source of truth for activation,
 * ordering and verification rules; this file only holds the route slug and
 * the art direction (imagery, hero film chapter) that ships with the code.
 */
export const categorySlugs = [
  "coiffeuses",
  "esthetique",
  "massage",
  "nails",
  "extensions-de-cils",
  "botox",
] as const;

export type CategorySlug = (typeof categorySlugs)[number];

export function isCategorySlug(value: string): value is CategorySlug {
  return (categorySlugs as readonly string[]).includes(value);
}

export type CategoryArt = {
  slug: CategorySlug;
  image: string;
  /** Category requires credential review before a profile can be published. */
  regulated?: boolean;
};

export const categoryArt: Record<CategorySlug, CategoryArt> = {
  coiffeuses: { slug: "coiffeuses", image: "/images/hero/chapter-3.jpg" },
  esthetique: { slug: "esthetique", image: "/images/hero/chapter-10.jpg" },
  nails: { slug: "nails", image: "/images/hero/chapter-17.jpg" },
  massage: { slug: "massage", image: "/images/hero/chapter-25.jpg" },
  "extensions-de-cils": { slug: "extensions-de-cils", image: "/images/backgrounds/blush-butterflies.jpg" },
  botox: { slug: "botox", image: "/images/backgrounds/rose-filigree.jpg", regulated: true },
};

/** Order of the four chapters (scenes) of the home hero; see src/config/hero-scenes.ts. */
export const heroFilmChapters: CategorySlug[] = ["coiffeuses", "esthetique", "nails", "massage"];
