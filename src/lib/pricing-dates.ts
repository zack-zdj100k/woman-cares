import { addDays } from "./availability";
import { algiersParts } from "./time";

/**
 * Subscription prices change on a calendar day in Algiers (UTC+1, no daylight saving).
 * A price row takes effect on the Algiers date of its `effectiveFrom`; rows are never edited,
 * a later row simply takes over. Two rows on the same day: the one created last wins.
 */

export const MAX_PRICE_DZD = 1_000_000;
const MAX_AHEAD_DAYS = 730;

export function algiersToday(now = new Date()) {
  return algiersParts(now).date;
}

/** The instant a YYYY-MM-DD date starts in Algiers. */
export function algiersMidnight(day: string) {
  return new Date(`${day}T00:00:00+01:00`);
}

export function isIsoDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** A new price starts tomorrow at the earliest (today's price is already public), and at most two years ahead. */
export function isValidPriceStart(day: string, today: string) {
  return isIsoDay(day) && day > today && day <= addDays(today, MAX_AHEAD_DAYS);
}

/** Whole dinars, above zero, below a sanity ceiling. Returns null when the input is not a valid price. */
export function parsePrice(value: string) {
  const v = value.replace(/[\s  ]/g, "");
  if (!/^\d{1,7}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= MAX_PRICE_DZD ? n : null;
}

type Row = { id: string; effectiveFrom: Date; effectiveTo?: Date | null; createdAt: Date };

/** Newest first, as the history is shown: by start date, then by creation. */
export function sortPriceRows<T extends Row>(rows: T[]) {
  return [...rows].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
}

export type PriceState = "current" | "upcoming" | "replaced" | "past";

/**
 * Labels every row of one category for a given Algiers day: the row in effect, rows still to come,
 * rows that were in effect before, and rows overtaken by a later entry for the same day.
 */
export function priceStates<T extends Row>(rows: T[], today: string): Map<string, PriceState> {
  const states = new Map<string, PriceState>();
  const seenDays = new Set<string>();
  let current: string | null = null;
  for (const r of sortPriceRows(rows)) {
    const day = algiersToday(r.effectiveFrom);
    const ended = r.effectiveTo ? algiersToday(r.effectiveTo) <= today : false;
    if (seenDays.has(day)) states.set(r.id, "replaced");
    else if (day > today) states.set(r.id, "upcoming");
    else if (!current && !ended) {
      current = r.id;
      states.set(r.id, "current");
    } else states.set(r.id, "past");
    seenDays.add(day);
  }
  return states;
}
