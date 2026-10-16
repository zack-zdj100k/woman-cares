import { HERO_FILM_DURATION, categoryArt, heroFilmChapters } from "@/config/categories";

/** Chapter start times (seconds) in public/media/hero-woman-cares.mp4. */
export const starts = heroFilmChapters.map((slug) => categoryArt[slug].filmChapterStart ?? 0);

/** The visible chapter switches halfway through each 0.8 s crossfade. */
const switchAt = starts.map((s, i) => (i === 0 ? 0 : s + 0.4));

/** Scroll progress beyond which the film follows the scroll instead of playing freely. */
export const ENGAGED = 0.03;

/** Index of the chapter on screen at film time `t`. */
export function chapterAt(t: number) {
  let c = 0;
  for (let i = 0; i < switchAt.length; i++) if (t >= switchAt[i]) c = i;
  return c;
}

/** 0..1 progress through chapter `c` at film time `t`. */
export function progressWithin(t: number, c: number) {
  const from = switchAt[c];
  const to = switchAt[c + 1] ?? HERO_FILM_DURATION;
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/**
 * Clamped linear mapping. Function-form transforms keep Motion on the JS path;
 * its accelerated scroll path mis-mapped targeted offsets (opacities stuck mid-way).
 */
export function map([a, b]: number[], [from, to]: number[]) {
  return (v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return from + (to - from) * t;
  };
}
