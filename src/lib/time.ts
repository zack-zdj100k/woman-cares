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
