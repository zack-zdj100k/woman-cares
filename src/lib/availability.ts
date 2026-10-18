/**
 * Slot generation (pure, no I/O): which start times a client can request for one service.
 *
 * Rules
 *  - Local time is Africa/Algiers (UTC+1, no daylight saving): local minute m on date D is
 *    D 00:00 UTC + (m - 60) minutes.
 *  - A day's windows come from the weekly schedule, unless an exception exists for that date:
 *    a closed exception removes the day; an open one with hours replaces the windows.
 *  - A start s fits when s + duration ≤ window end; starts are on a 15-minute grid.
 *  - Each active booking blocks [start, end + its buffer). A slot blocks [s, s + duration + buffer).
 *    The slot is offered while fewer than `capacity` active bookings overlap it.
 *  - Slots earlier than now + lead time are never offered.
 */

export const SLOT_STEP = 15;
export const DEFAULT_LEAD_MINUTES = 120;
export const MAX_HORIZON_DAYS = 60;

export type Window = { weekday: number; startMinute: number; endMinute: number; capacity: number };
export type Exception = { date: string; isClosed: boolean; startMinute: number | null; endMinute: number | null; capacity: number | null };
export type Busy = { startAt: Date; endAt: Date; bufferMinutes: number };
export type Slot = { startAt: Date; minute: number; remaining: number };
export type Day = { date: string; weekday: number; slots: Slot[] };

/** Instant of local minute `minute` on local date `date` (YYYY-MM-DD) in Algiers. */
export function algiersInstant(date: string, minute: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minute - 60));
}

export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function computeDays(input: {
  dates: string[];
  windows: Window[];
  exceptions: Exception[];
  busy: Busy[];
  durationMinutes: number;
  bufferMinutes: number;
  now: Date;
  leadMinutes?: number;
  /** Session length: starts are counted from the start of each working range in this step (default 15). */
  stepMinutes?: number | null;
}): Day[] {
  const step = input.stepMinutes && input.stepMinutes > 0 ? input.stepMinutes : SLOT_STEP;
  const earliest = input.now.getTime() + (input.leadMinutes ?? DEFAULT_LEAD_MINUTES) * 60_000;
  const blocks = input.busy.map((b) => ({ from: b.startAt.getTime(), to: b.endAt.getTime() + b.bufferMinutes * 60_000 }));
  const byDate = new Map(input.exceptions.map((e) => [e.date, e]));

  return input.dates.map((date) => {
    const weekday = weekdayOf(date);
    const exception = byDate.get(date);
    let windows: { startMinute: number; endMinute: number; capacity: number }[];
    if (exception?.isClosed) windows = [];
    else if (exception && exception.startMinute !== null && exception.endMinute !== null)
      windows = [{ startMinute: exception.startMinute, endMinute: exception.endMinute, capacity: exception.capacity ?? 1 }];
    else windows = input.windows.filter((w) => w.weekday === weekday);

    const slots: Slot[] = [];
    for (const w of windows) {
      // A session grid starts at the range start (09:00, 09:45…); the default quarter-hour grid stays aligned on :00/:15/:30/:45.
      const first = step === SLOT_STEP ? Math.ceil(w.startMinute / SLOT_STEP) * SLOT_STEP : w.startMinute;
      for (let minute = first; minute + input.durationMinutes <= w.endMinute; minute += step) {
        const startAt = algiersInstant(date, minute);
        const from = startAt.getTime();
        if (from < earliest) continue;
        const to = from + (input.durationMinutes + input.bufferMinutes) * 60_000;
        const overlapping = blocks.filter((b) => b.from < to && from < b.to).length;
        const remaining = w.capacity - overlapping;
        if (remaining > 0) slots.push({ startAt, minute, remaining });
      }
    }
    slots.sort((a, b) => a.minute - b.minute);
    return { date, weekday, slots };
  });
}
