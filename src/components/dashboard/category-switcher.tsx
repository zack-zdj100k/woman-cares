import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Category switcher for the professional dashboard (All categories or one), plus an optional period
 * switch. State lives in the URL (?category=…&period=…) so it survives navigation and reloads.
 */
export function CategorySwitcher({
  base,
  categories,
  active,
  period,
  labels,
  keep,
}: {
  /** Other URL parameters to carry over (for example the table filter). */
  keep?: Record<string, string>;
  base: string;
  categories: { slug: string; name: string }[];
  active: string | null;
  period?: string;
  labels: { all: string; label: string; periods?: Record<string, string>; periodLabel?: string };
}) {
  const href = (category: string | null, p = period) => {
    const q = new URLSearchParams(keep);
    if (category) q.set("category", category);
    if (p && p !== "month") q.set("period", p);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const pill = (on: boolean) => cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors", on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/6 hover:text-foreground");
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={labels.label} className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        <Link href={href(null)} aria-current={!active ? "page" : undefined} className={pill(!active)}>
          {labels.all}
        </Link>
        {categories.map((c) => (
          <Link key={c.slug} href={href(c.slug)} aria-current={active === c.slug ? "page" : undefined} className={pill(active === c.slug)}>
            {c.name}
          </Link>
        ))}
      </nav>
      {labels.periods && period && (
        <nav aria-label={labels.periodLabel} className="flex gap-1 rounded-full border border-border p-1">
          {Object.entries(labels.periods).map(([key, label]) => (
            <Link key={key} href={href(active, key)} aria-current={period === key ? "page" : undefined} className={pill(period === key)}>
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
