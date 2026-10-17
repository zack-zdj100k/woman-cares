/** Horizontal bars for a short ranked list (categories, methods, services, weekdays). */
export function BarList({ rows, empty }: { rows: { key: string; label: string; value: number; display: string }[]; empty: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0 || max <= 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid gap-1 text-sm">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.display}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-white/6" aria-hidden="true">
            <span className="block h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, (Math.max(0, r.value) / max) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
