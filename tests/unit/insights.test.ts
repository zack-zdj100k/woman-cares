import { describe, expect, it } from "vitest";
import { algiersClock, hourHistogram, lastMonths, layoutDay, rate, weekdayHistogram } from "@/lib/insights";

describe("insights helpers", () => {
  it("returns no rate without data instead of an invented zero", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(1, 4)).toBe(0.25);
  });

  it("reads the Algiers clock (UTC+1, no daylight saving)", () => {
    expect(algiersClock(new Date("2026-10-16T23:30:00Z"))).toEqual({ weekday: 6, minute: 30 }); // Saturday 00:30 local
    expect(algiersClock(new Date("2026-07-01T08:00:00Z")).minute).toBe(540);
  });

  it("orders weekdays from Saturday and fills empty hours between busy ones", () => {
    const days = weekdayHistogram([new Date("2026-10-17T09:00:00Z"), new Date("2026-10-17T10:00:00Z"), new Date("2026-10-19T09:00:00Z")]);
    expect(days.map((d) => d.weekday)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(days[0].count).toBe(2);
    expect(days[2].count).toBe(1);
    expect(hourHistogram([new Date("2026-10-17T08:00:00Z"), new Date("2026-10-17T11:15:00Z")])).toEqual([
      { hour: 9, count: 1 },
      { hour: 10, count: 0 },
      { hour: 11, count: 0 },
      { hour: 12, count: 1 },
    ]);
    expect(hourHistogram([])).toEqual([]);
  });

  it("lists the last twelve months across a year boundary", () => {
    const m = lastMonths(12, new Date("2026-02-10T12:00:00Z"));
    expect(m[0]).toBe("2025-03");
    expect(m[11]).toBe("2026-02");
  });

  it("puts overlapping appointments side by side and lets separate ones use the full width", () => {
    const out = layoutDay([
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 630, end: 690 },
      { id: "c", start: 700, end: 760 },
    ]);
    const by = Object.fromEntries(out.map((e) => [e.id, e]));
    expect([by.a.lane, by.a.lanes]).toEqual([0, 2]);
    expect([by.b.lane, by.b.lanes]).toEqual([1, 2]);
    expect([by.c.lane, by.c.lanes]).toEqual([0, 1]);
  });
});
