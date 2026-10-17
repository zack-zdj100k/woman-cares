import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { algiersClock, layoutDay } from "@/lib/insights";
import { algiersDate, weekStart } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { getProviderWeek } from "@/server/services/provider-insights";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { CategorySwitcher } from "@/components/dashboard/category-switcher";
import { StatusBadge } from "@/components/dashboard/booking-ui";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.calendar.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/calendar">) {
  return (
    <Calendar params={params} searchParams={searchParams} />
  );
}

const PX = 1; // pixels per minute (60 px per hour)

const tone: Record<string, string> = {
  PENDING: "border-warning/60 bg-warning/10 border-dashed",
  RESCHEDULE_PROPOSED: "border-chart-1/60 bg-chart-1/10 border-dashed",
  ACCEPTED: "border-chart-1/70 bg-chart-1/20",
  COMPLETED: "border-border bg-white/5 text-muted-foreground",
  NO_SHOW: "border-destructive/50 bg-destructive/10 text-muted-foreground",
};

async function Calendar({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/calendar">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/calendar`);
  const sp = await searchParams;
  const [d, site, w] = await Promise.all([
    getDashboardDictionary(locale),
    getDictionary(locale),
    getProviderWeek(user, { week: typeof sp.week === "string" ? sp.week : undefined, category: typeof sp.category === "string" ? sp.category : undefined }),
  ]);
  const c = d.calendar;
  const b = d.bookings;
  const base = `/${locale}/dashboard/provider/calendar`;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const href = (week: string) => {
    const q = new URLSearchParams({ week });
    if (w.active) q.set("category", w.active);
    return `${base}?${q}`;
  };
  const thisWeek = weekStart(algiersDate(new Date()));
  const today = algiersDate(new Date());
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => formatDate(new Date(`${date}T12:00:00Z`), locale, { ...opts, timeZone: "UTC" });

  // Rows: from the earliest opening or appointment to the latest, in whole hours (default 09:00-18:00).
  const events = w.bookings.map((x) => {
    const s = algiersClock(x.startAt);
    const date = algiersDate(x.startAt);
    const end = date === algiersDate(x.endAt) ? algiersClock(x.endAt).minute : 24 * 60;
    return { ...x, date, start: s.minute, end: Math.max(end, s.minute + 15) };
  });
  const minutes = [...w.windows.flatMap((x) => [x.startMinute, x.endMinute]), ...events.flatMap((e) => [e.start, e.end])];
  const top = minutes.length ? Math.floor(Math.min(...minutes) / 60) * 60 : 9 * 60;
  const bottom = minutes.length ? Math.ceil(Math.max(...minutes) / 60) * 60 : 18 * 60;
  const hours = Array.from({ length: (bottom - top) / 60 }, (_, i) => top + i * 60);

  const days = w.days.map((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return {
      date,
      windows: w.windows.filter((x) => x.weekday === weekday),
      closures: w.closures.filter((x) => x.date.toISOString().slice(0, 10) === date),
      events: layoutDay(events.filter((e) => e.date === date)),
    };
  });

  return (
    <div className={pageClass}>
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <div className="flex items-center gap-2">
            <Link href={href(w.previous)} className={buttonClass({ variant: "outline", size: "icon" })} aria-label={c.previous}>
              <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Link href={href(thisWeek)} aria-current={w.days[0] === thisWeek ? "page" : undefined} className={buttonClass({ variant: "outline", size: "sm" })}>
              {c.today}
            </Link>
            <Link href={href(w.next)} className={buttonClass({ variant: "outline", size: "icon" })} aria-label={c.next}>
              <ChevronRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        }
      />
      {w.categories.length > 1 && (
        <CategorySwitcher base={base} keep={{ week: w.days[0] }} categories={w.categories.map((s) => ({ slug: s, name: name(s) }))} active={w.active} labels={{ all: d.switcher.all, label: d.switcher.label }} />
      )}
      <p className="mb-4 text-sm font-medium">{c.weekOf(dayLabel(w.days[0], { day: "numeric", month: "long" }), dayLabel(w.days[6], { day: "numeric", month: "long", year: "numeric" }))}</p>

      {/* Phones and tablets: an agenda, one block per day. */}
      <div className="grid gap-3 lg:hidden">
        {days.map((day) => (
          <Card key={day.date} className={cn(day.date === today && "border-chart-1/50")}>
            <CardContent className="grid gap-3 pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{dayLabel(day.date, { weekday: "long", day: "numeric", month: "long" })}</h2>
                <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                  {day.windows.length ? day.windows.map((x) => `${hm(x.startMinute)}-${hm(x.endMinute)}`).join(" · ") : c.noHours}
                </span>
              </div>
              {day.closures.map((x, i) => (
                <p key={i} className="text-xs text-warning">
                  {x.isClosed ? c.closed : c.closure} · {name(x.profile.category.slug)}
                  {x.note ? ` · ${x.note}` : ""}
                </p>
              ))}
              {day.events.length > 0 && (
                <ul className="divide-y divide-border">
                  {day.events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/${locale}/dashboard/provider/bookings/${e.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-white/3">
                        <span className="min-w-0">
                          <span className="block tabular-nums" dir="ltr">
                            {hm(e.start)}-{hm(e.end % (24 * 60))}
                          </span>
                          <span className="block truncate font-medium">{e.client.fullName}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {e.serviceNameSnap} · {name(e.profile.category.slug)}
                          </span>
                        </span>
                        <StatusBadge status={e.status} labels={b.providerStatuses} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && <p className="text-sm text-muted-foreground">{c.empty}</p>}
      </div>

      {/* Desktop: a time grid. */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border">
          <span />
          {days.map((day) => (
            <div key={day.date} className={cn("border-s border-border px-2 py-2.5 text-center", day.date === today && "bg-chart-1/8")}>
              <p className="text-xs text-muted-foreground">{dayLabel(day.date, { weekday: "short" })}</p>
              <p className={cn("text-lg font-semibold tabular-nums", day.date === today && "text-chart-1")}>{dayLabel(day.date, { day: "numeric" })}</p>
              {day.closures.length > 0 && <p className="mt-0.5 truncate text-[0.7rem] text-warning">{day.closures.some((x) => x.isClosed) ? c.closed : c.closure}</p>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: (bottom - top) * PX }}>
            {hours.map((h) => (
              <span key={h} className="absolute end-2 -translate-y-1/2 text-[0.7rem] text-muted-foreground tabular-nums first:translate-y-0" style={{ top: (h - top) * PX }} dir="ltr">
                {hm(h)}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <div key={day.date} className="relative border-s border-border" style={{ height: (bottom - top) * PX }}>
              {hours.map((h) => (
                <span key={h} className="absolute inset-x-0 border-t border-white/5" style={{ top: (h - top) * PX }} aria-hidden="true" />
              ))}
              {day.windows.map((x, i) => (
                <span key={i} className="absolute inset-x-0 bg-white/[0.025]" style={{ top: (x.startMinute - top) * PX, height: (x.endMinute - x.startMinute) * PX }} aria-hidden="true" />
              ))}
              {day.events.map((e) => (
                <Link
                  key={e.id}
                  href={`/${locale}/dashboard/provider/bookings/${e.id}`}
                  className={cn("absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[0.7rem] leading-tight transition-colors hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", tone[e.status] ?? "border-border bg-white/5")}
                  style={{ top: (e.start - top) * PX + 1, height: Math.max(22, (e.end - e.start) * PX - 2), insetInlineStart: `calc(${(e.lane / e.lanes) * 100}% + 2px)`, width: `calc(${100 / e.lanes}% - 4px)` }}
                  title={`${hm(e.start)} ${e.client.fullName} · ${e.serviceNameSnap} · ${b.providerStatuses[e.status]}`}
                >
                  <span className="block font-medium tabular-nums" dir="ltr">
                    {hm(e.start)}
                  </span>
                  <span className="block truncate">{e.client.fullName}</span>
                  <span className="block truncate text-muted-foreground">{e.serviceNameSnap}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 hidden flex-wrap gap-3 text-xs text-muted-foreground lg:flex" aria-label={c.legend}>
        {(["ACCEPTED", "PENDING", "RESCHEDULE_PROPOSED", "COMPLETED", "NO_SHOW"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-3 rounded border", tone[s])} aria-hidden="true" />
            {b.providerStatuses[s]}
          </span>
        ))}
      </div>
      {events.length === 0 && <p className="mt-3 hidden text-sm text-muted-foreground lg:block">{c.empty}</p>}
    </div>
  );
}
