import { describe, expect, it } from "vitest";
import { chapterForProgress, entryFor, hiddenClip, map } from "@/lib/hero-film";

describe("hero chapters", () => {
  it("gives each quarter of the scroll to one chapter, clamped", () => {
    expect([0, 0.24, 0.25, 0.5, 0.74, 0.99, 1].map((v) => chapterForProgress(v, 4))).toEqual([0, 0, 1, 2, 2, 3, 3]);
    expect(chapterForProgress(-0.2, 4)).toBe(0);
  });

  it("brings scenes in from the right, the top and the left, mirrored in Arabic", () => {
    expect([1, 2, 3].map((i) => entryFor(i, false))).toEqual([{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }]);
    expect([1, 2, 3].map((i) => entryFor(i, true))).toEqual([{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }]);
    expect(entryFor(0, false)).toEqual({ x: 0, y: 0 });
  });

  it("hides a scene toward the side it enters from", () => {
    expect(hiddenClip(entryFor(1, false))).toBe("inset(0% 0% 0% 100%)");
    expect(hiddenClip(entryFor(2, false))).toBe("inset(0% 0% 100% 0%)");
    expect(hiddenClip(entryFor(3, false))).toBe("inset(0% 100% 0% 0%)");
  });
});

describe("map", () => {
  it("interpolates and clamps", () => {
    const f = map([0.5, 0.7], [1, 0]);
    expect(f(0)).toBe(1);
    expect(f(0.6)).toBeCloseTo(0.5);
    expect(f(1)).toBe(0);
  });
});
