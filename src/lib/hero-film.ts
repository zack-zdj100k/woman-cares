/** Scroll progress beyond which the chapter follows the scroll instead of advancing on its own. */
export const ENGAGED = 0.03;

/** Chapter shown at scroll progress `value` (each equal slice of the pinned scroll is one chapter). */
export function chapterForProgress(value: number, count: number) {
  return Math.min(count - 1, Math.max(0, Math.floor(value * count)));
}

/**
 * Where each scene comes from when it enters: scene 1 from the inline-end side, scene 2 from the top,
 * scene 3 from the inline-start side (mirrored in Arabic). Scene 0 is the base and never moves.
 */
export type Entry = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
export function entryFor(index: number, rtl: boolean): Entry {
  const flip = rtl ? -1 : 1;
  if (index === 1) return { x: (1 * flip) as 1 | -1, y: 0 };
  if (index === 2) return { x: 0, y: -1 };
  if (index === 3) return { x: (-1 * flip) as 1 | -1, y: 0 };
  return { x: 0, y: 0 };
}

/** The clip that hides a scene entirely, shrunk toward the side it enters from. */
export function hiddenClip({ x, y }: Entry) {
  if (x > 0) return "inset(0% 0% 0% 100%)";
  if (x < 0) return "inset(0% 100% 0% 0%)";
  if (y < 0) return "inset(0% 0% 100% 0%)";
  return "inset(100% 0% 0% 0%)";
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
