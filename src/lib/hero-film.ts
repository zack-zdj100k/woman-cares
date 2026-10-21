/**
 * What one scroll gesture does while the hero is locked: move to the next or previous scene, release the
 * page to the landing content after the last scene (scrolling down), or nothing (already at the first
 * scene and the very top).
 */
export type Step = { kind: "scene"; to: number } | { kind: "release" } | { kind: "none" };

export function nextStep(current: number, direction: 1 | -1, count: number): Step {
  if (direction > 0) return current < count - 1 ? { kind: "scene", to: current + 1 } : { kind: "release" };
  return current > 0 ? { kind: "scene", to: current - 1 } : { kind: "none" };
}

/** Wheel and swipe sizes below these are treated as noise (trackpad rest, finger tremor). */
export const WHEEL_MIN = 4;
export const SWIPE_MIN = 36;

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
