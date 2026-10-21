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
  /** Start time (seconds) of this category's chapter in the hero film, if it has one. */
  filmChapterStart?: number;
  /** Category requires credential review before a profile can be published. */
  regulated?: boolean;
};

export const categoryArt: Record<CategorySlug, CategoryArt> = {
  coiffeuses: { slug: "coiffeuses", image: "/images/hero/chapter-3.jpg", filmChapterStart: 0 },
  esthetique: { slug: "esthetique", image: "/images/hero/chapter-10.jpg", filmChapterStart: 7.2 },
  nails: { slug: "nails", image: "/images/hero/chapter-17.jpg", filmChapterStart: 14.4 },
  massage: { slug: "massage", image: "/images/hero/chapter-25.jpg", filmChapterStart: 21.6 },
  "extensions-de-cils": { slug: "extensions-de-cils", image: "/images/backgrounds/blush-butterflies.jpg" },
  botox: { slug: "botox", image: "/images/backgrounds/rose-filigree.jpg", regulated: true },
};

/** Order of the four chapters inside public/media/hero-woman-cares.mp4. */
export const heroFilmChapters: CategorySlug[] = ["coiffeuses", "esthetique", "nails", "massage"];
export const HERO_FILM_DURATION = 29.58;
/** Each source clip fades into the next over 0.8 s; this skips past the fade when seeking. */
export const HERO_FILM_SEEK_OFFSET = 0.85;
