import { describe, expect, it } from "vitest";
import { chapterAt, map, progressWithin, starts } from "@/lib/hero-film";

describe("hero film chapters", () => {
  it("starts each chapter where the clips were joined", () => {
    expect(starts).toEqual([0, 7.2, 14.4, 21.6]);
  });

  it("switches chapter halfway through each crossfade", () => {
    expect(chapterAt(0)).toBe(0);
    expect(chapterAt(7.5)).toBe(0);
    expect(chapterAt(7.7)).toBe(1);
    expect(chapterAt(14.8)).toBe(2);
    expect(chapterAt(29.5)).toBe(3);
  });

  it("reports progress within the current chapter, clamped", () => {
    expect(progressWithin(0, 0)).toBe(0);
    expect(progressWithin(7.6, 0)).toBeCloseTo(1, 6);
    expect(progressWithin(29.58, 3)).toBeCloseTo(1, 2);
    expect(progressWithin(-1, 0)).toBe(0);
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
