import { describe, expect, it } from "vitest";
import { entryFor, hiddenClip, nextStep } from "@/lib/hero-film";

describe("locked hero steps", () => {
  it("moves one scene per gesture, in both directions", () => {
    expect(nextStep(0, 1, 4)).toEqual({ kind: "scene", to: 1 });
    expect(nextStep(2, 1, 4)).toEqual({ kind: "scene", to: 3 });
    expect(nextStep(3, -1, 4)).toEqual({ kind: "scene", to: 2 });
    expect(nextStep(1, -1, 4)).toEqual({ kind: "scene", to: 0 });
  });

  it("releases the page to the landing content only after the last scene", () => {
    expect(nextStep(3, 1, 4)).toEqual({ kind: "release" });
    expect(nextStep(2, 1, 4).kind).toBe("scene");
  });

  it("does nothing when scrolling up from the first scene", () => {
    expect(nextStep(0, -1, 4)).toEqual({ kind: "none" });
  });
});

describe("hero scene entries", () => {
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
