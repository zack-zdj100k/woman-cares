import { describe, expect, it } from "vitest";
import { addDays, algiersInstant, computeDays, weekdayOf } from "@/lib/availability";

// 2026-10-17 is a Saturday (weekday 6).
const SAT = "2026-10-17";
const base = {
  dates: [SAT],
  windows: [{ weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60, capacity: 1 }],
  exceptions: [],
  busy: [],
  durationMinutes: 60,
  bufferMinutes: 0,
  now: new Date("2026-10-01T00:00:00Z"),
};
const times = (d: ReturnType<typeof computeDays>[number]) => d.slots.map((s) => s.minute);

describe("Algiers dates", () => {
  it("maps local minutes to UTC (UTC+1, no daylight saving)", () => {
    expect(algiersInstant(SAT, 9 * 60).toISOString()).toBe("2026-10-17T08:00:00.000Z");
    expect(algiersInstant(SAT, 0).toISOString()).toBe("2026-10-16T23:00:00.000Z");
    expect(weekdayOf(SAT)).toBe(6);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("slot generation", () => {
  it("offers 15-minute starts that let the service end inside the window", () => {
    const [day] = computeDays(base);
    expect(times(day)[0]).toBe(540);
    expect(times(day).at(-1)).toBe(660); // 11:00 + 60 min = 12:00
    expect(times(day)).toHaveLength(9);
  });

  it("returns nothing on days without hours and on closed exceptions", () => {
    expect(computeDays({ ...base, dates: ["2026-10-18"] })[0].slots).toEqual([]);
    expect(computeDays({ ...base, exceptions: [{ date: SAT, isClosed: true, startMinute: null, endMinute: null, capacity: null }] })[0].slots).toEqual([]);
  });

  it("lets an open exception replace the weekly hours", () => {
    const [day] = computeDays({ ...base, exceptions: [{ date: SAT, isClosed: false, startMinute: 14 * 60, endMinute: 16 * 60, capacity: 2 }] });
    expect(times(day)[0]).toBe(840);
    expect(day.slots[0].remaining).toBe(2);
  });

  it("blocks overlapping times, including the booked service's buffer, up to capacity", () => {
    const busy = [{ startAt: algiersInstant(SAT, 600), endAt: algiersInstant(SAT, 660), bufferMinutes: 15 }]; // 10:00-11:00 (+15)
    const [one] = computeDays({ ...base, busy });
    expect(times(one)).not.toContain(600);
    expect(times(one)).not.toContain(660); // 11:00 falls in the 15-minute buffer
    expect(times(one)).not.toContain(555); // 09:15 + 60 min overlaps 10:00
    expect(times(one)).toContain(540);
    const [two] = computeDays({ ...base, busy, windows: [{ ...base.windows[0], capacity: 2 }] });
    expect(two.slots.find((s) => s.minute === 600)?.remaining).toBe(1);
  });

  it("adds the new service's own buffer before the next booking", () => {
    const busy = [{ startAt: algiersInstant(SAT, 600), endAt: algiersInstant(SAT, 660), bufferMinutes: 0 }];
    const [day] = computeDays({ ...base, busy, bufferMinutes: 15 });
    // Before 10:00 nothing fits once the 15-minute buffer is added; 11:00 is the only start left.
    expect(times(day)).toEqual([660]);
  });

  it("never offers times inside the notice period", () => {
    const [day] = computeDays({ ...base, now: algiersInstant(SAT, 8 * 60), leadMinutes: 120 });
    expect(times(day)[0]).toBe(600); // 08:00 + 2 h
    const [late] = computeDays({ ...base, now: algiersInstant(SAT, 9 * 60 + 5), leadMinutes: 120 });
    expect(late.slots).toEqual([]); // 11:15 would end after 12:00
  });
});
