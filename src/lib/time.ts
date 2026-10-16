/** "08:30" from minutes after local midnight. */
export function minutesToHHMM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Groups weekly windows by weekday, Saturday first (the Algerian week starts on Saturday).
 * Returns 7 rows; a day without windows is closed.
 */
export function weeklyHours(windows: { weekday: number; startMinute: number; endMinute: number }[]) {
  const order = [6, 0, 1, 2, 3, 4, 5];
  return order.map((weekday) => ({
    weekday,
    ranges: windows
      .filter((w) => w.weekday === weekday)
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((w) => `${minutesToHHMM(w.startMinute)} - ${minutesToHHMM(w.endMinute)}`),
  }));
}

/** Calendar date, weekday (0 = Sunday) and minutes after midnight of an instant, in Africa/Algiers. */
export function algiersParts(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Every YYYY-MM-DD from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
