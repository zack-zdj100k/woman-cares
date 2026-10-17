/**
 * Pure helpers for the professional's calendar, earnings and analytics. Algiers time is UTC+1
 * all year (no daylight saving), so local minutes and weekdays are computed with a fixed offset.
 */
const OFFSET = 3_600_000;

/** Share as a 0..1 number, or null when there is nothing to divide by (shown as "not enough data"). */
export function rate(part: number, whole: number) {
  return whole > 0 ? part / whole : null;
}

/** Local weekday (0 = Sunday … 6 = Saturday) and minutes from local midnight of an instant. */
export function algiersClock(at: Date) {
  const local = new Date(at.getTime() + OFFSET);
  return { weekday: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** Counts per local weekday, ordered from Saturday (the Algerian week) to Friday. */
export function weekdayHistogram(dates: Date[]) {
  const order = [6, 0, 1, 2, 3, 4, 5];
  const counts = new Map(order.map((d) => [d, 0]));
  for (const d of dates) {
    const w = algiersClock(d).weekday;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return order.map((weekday) => ({ weekday, count: counts.get(weekday)! }));
}

/** Counts per local starting hour, only for hours that have at least one booking or sit between them. */
export function hourHistogram(dates: Date[]) {
  const counts = new Map<number, number>();
  for (const d of dates) {
    const h = Math.floor(algiersClock(d).minute / 60);
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const hours = [...counts.keys()];
  const [min, max] = [Math.min(...hours), Math.max(...hours)];
  return Array.from({ length: max - min + 1 }, (_, i) => ({ hour: min + i, count: counts.get(min + i) ?? 0 }));
}

/** The 12 local months ending with the current one, as YYYY-MM keys (oldest first). */
export function lastMonths(n: number, now = new Date()) {
  const local = new Date(now.getTime() + OFFSET);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/**
 * Places overlapping appointments of one day side by side. Each event gets a lane and the number of
 * lanes in its overlap group, so the calendar can size it as 1/lanes of the column.
 */
export function layoutDay<T extends { start: number; end: number }>(events: T[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) g.lanes = lanes;
    out.push(...group);
    group = [];
  };
  for (const e of sorted) {
    if (group.length && e.start >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.end > e.start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ ...e, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, e.end);
  }
  if (group.length) flush();
  return out;
}
