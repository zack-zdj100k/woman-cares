/**
 * Reporting periods on the Africa/Algiers calendar (UTC+1, no daylight saving). Weeks start on
 * Saturday, as the Algerian working week does.
 */
const DAY = 86_400_000;
const OFFSET = 3_600_000; // UTC+1

/** Local Algiers date (YYYY-MM-DD) of an instant. */
export function algiersDate(at: Date) {
  return new Date(at.getTime() + OFFSET).toISOString().slice(0, 10);
}

/** The instant of local midnight of a YYYY-MM-DD Algiers date. */
export function algiersMidnight(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) - OFFSET);
}

/** Saturday (local) on or before the given local date. */
export function weekStart(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 1) % 7; // Saturday = 6 → 0 days back
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}

/** The last `n` weeks (oldest first), each as its local Saturday date and the instant it starts. */
export function lastWeeks(n: number, now = new Date()) {
  const current = weekStart(algiersDate(now));
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.parse(`${current}T00:00:00Z`) - (n - 1 - i) * 7 * DAY).toISOString().slice(0, 10);
    return { date, start: algiersMidnight(date) };
  });
}

export type PeriodKey = "week" | "month" | "year";

/** Start instant of the current Algiers week, month or year, and of the same-length previous period. */
export function periodRange(period: PeriodKey, now = new Date()) {
  const today = algiersDate(now);
  let from: string;
  let prevFrom: string;
  if (period === "week") {
    from = weekStart(today);
    prevFrom = new Date(Date.parse(`${from}T00:00:00Z`) - 7 * DAY).toISOString().slice(0, 10);
  } else if (period === "month") {
    from = `${today.slice(0, 7)}-01`;
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    prevFrom = d.toISOString().slice(0, 10);
  } else {
    from = `${today.slice(0, 4)}-01-01`;
    prevFrom = `${Number(today.slice(0, 4)) - 1}-01-01`;
  }
  return { from: algiersMidnight(from), prevFrom: algiersMidnight(prevFrom), to: now };
}
