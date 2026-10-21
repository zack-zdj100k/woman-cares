import type { CategorySlug } from "./categories";

/**
 * The four scenes of the home hero, one clip per category chapter (public/media/hero-{key}.mp4, and a
 * -960 version for phones). The first scene is on screen at load; each scroll step brings the next one
 * in from a different side (see `entries`).
 */
export type HeroScene = { slug: CategorySlug; key: string; poster: string; position: string };

export const heroScenes: HeroScene[] = [
  { slug: "coiffeuses", key: "hair", poster: "/images/hero/scene-hair.jpg", position: "60% 50%" },
  { slug: "esthetique", key: "skin", poster: "/images/hero/scene-skin.jpg", position: "58% 50%" },
  { slug: "nails", key: "nails", poster: "/images/hero/scene-nails.jpg", position: "50% 50%" },
  { slug: "massage", key: "massage", poster: "/images/hero/scene-massage.jpg", position: "66% 55%" },
];

/** Seconds each scene stays before the next one comes in, while the visitor has not scrolled. */
export const SCENE_SECONDS = 6.5;
