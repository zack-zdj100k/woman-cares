import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { clientLabel } from "@/lib/booking-rules";
import { formatDate } from "@/lib/format";
import { algiersClock } from "@/lib/insights";
import { algiersDate, algiersMidnight, weekStart } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { getProviderWeek } from "@/server/services/provider-insights";
import { listMyServices } from "@/server/services/booking-manual";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { CategorySwitcher } from "@/components/dashboard/category-switcher";
import { StatusBadge } from "@/components/dashboard/booking-ui";
import { ManualBookingForm } from "@/components/dashboard/manual-booking-form";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.calendar.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/calendar">) {
  return <Calendar params={params} searchParams={searchParams} />;
}

const LIVE = new Set(["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED"]);
const dot: Record<string, string> = {
  PENDING: "bg-warning",
  RESCHEDULE_PROPOSED: "bg-chart-1",
  ACCEPTED: "bg-success",
  COMPLETED: "bg-muted-foreground",
  NO_SHOW: "bg-destructive",
};

type Range = { start: number; end: number; capacity: number };

/** Opening ranges of one day: a closure or a special opening replaces the weekly hours. */
function rangesOf(date: string, weekly: { weekday: number; startMinute: number; endMinute: number; capacity: number }[], closures: { date: Date; isClosed: boolean; startMinute: number | null; endMinute: number | null; capacity: number | null }[]): Range[] {
  const exception = closures.find((c) => c.date.toISOString().slice(0, 10) === date);
  if (exception?.isClosed) return [];
  if (exception && exception.startMinute !== null && exception.endMinute !== null) return [{ start: exception.startMinute, end: exception.endMinute, capacity: exception.capacity ?? 1 }];
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekly.filter((w) => w.weekday === weekday).map((w) => ({ start: w.startMinute, end: w.endMinute, capacity: w.capacity }));
}

/** Session starts of a range: from the opening, every `step` minutes, the last one ending at closing time. */
function sessionsOf(ranges: Range[], step: number) {
  return ranges.flatMap((r) => Array.from({ length: Math.max(0, Math.floor((r.end - r.start) / step)) }, (_, i) => ({ minute: r.start + i * step, capacity: r.capacity })));
}

async function Calendar({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/calendar">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/calendar`);
  const sp = await searchParams;
  const adding = sp.new === "1";
  const [d, site, w, allServices] = await Promise.all([
    getDashboardDictionary(locale),
    getDictionary(locale),
    getProviderWeek(user, { week: typeof sp.week === "string" ? sp.week : undefined, category: typeof sp.category === "string" ? sp.category : undefined }),
    adding ? listMyServices(user) : Promise.resolve([]),
  ]);
  const c = d.calendar;
  const b = d.bookings;
  const base = `/${locale}/dashboard/provider/calendar`;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const href = (week: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ week, ...extra });
    if (w.active) q.set("category", w.active);
    return `${base}?${q}`;
  };
  const addHref = (day: string, time: string) => href(w.days[0], { new: "1", day, time });
  const thisWeek = weekStart(algiersDate(new Date()));
  const today = algiersDate(new Date());
  const now = new Date().getTime();
  const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => formatDate(new Date(`${date}T12:00:00Z`), locale, { ...opts, timeZone: "UTC" });
  const bookingHref = (id: string) => `/${locale}/dashboard/provider/bookings/${id}`;

  const events = w.bookings.map((x) => ({ ...x, date: algiersDate(x.startAt), start: algiersClock(x.startAt).minute }));
  const days = w.days.map((date) => {
    const ranges = rangesOf(date, w.windows, w.closures);
    const sessions = sessionsOf(ranges, w.step);
    const dayStart = algiersMidnight(date).getTime();
    const mine = events.filter((e) => e.date === date);
    const cells = new Map(
      sessions.map((s) => {
        const from = dayStart + s.minute * 60_000;
        const to = from + w.step * 60_000;
        const starts = mine.filter((e) => e.start >= s.minute && e.start < s.minute + w.step);
        const taken = w.bookings.filter((x) => LIVE.has(x.status) && x.startAt.getTime() < to && x.endAt.getTime() > from).length;
        return [s.minute, { starts, taken, capacity: s.capacity, open: from > now && taken < s.capacity }] as const;
      }),
    );
    const placed = new Set([...cells.values()].flatMap((cell) => cell.starts.map((e) => e.id)));
    return { date, ranges, cells, outside: mine.filter((e) => !placed.has(e.id)), closures: w.closures.filter((x) => x.date.toISOString().slice(0, 10) === date) };
  });
  const rows = [...new Set(days.flatMap((day) => [...day.cells.keys()]))].sort((a, b) => a - b);
  /** The weekly number of places (postes), shown once in the header instead of in every empty cell. */
  const capacity = Math.max(0, ...days.flatMap((day) => [...day.cells.values()].map((x) => x.capacity)));
  const hasOutside = days.some((day) => day.outside.length > 0);
  const services = allServices.filter((s) => s.profile.category.slug === w.active);

  const chip = (e: (typeof events)[number]) => (
    <Link
      key={e.id}
      href={bookingHref(e.id)}
      title={`${hm(e.start)} ${clientLabel(e)} · ${e.serviceNameSnap} · ${b.providerStatuses[e.status]}`}
      className="flex min-w-0 items-center gap-1.5 rounded-md bg-white/[0.06] px-1.5 py-1 text-[0.7rem] leading-tight hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dot[e.status] ?? "bg-muted-foreground")} aria-hidden="true" />
      <span className="truncate">
        {e.source === "MANUAL" && <span className="text-chart-1">• </span>}
        {clientLabel(e)}
      </span>
    </Link>
  );

  return (
    <div className={pageClass}>
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {w.profileId && (
              <Link href={addHref(today >= w.days[0] && today <= w.days[6] ? today : w.days[0], "09:00")} className={buttonClass({ variant: "solid", size: "sm" })}>
                <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                {c.add}
              </Link>
            )}
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
      {w.categories.length > 0 && (
        <CategorySwitcher base={base} keep={{ week: w.days[0] }} withAll={false} categories={w.categories.map((s) => ({ slug: s, name: name(s) }))} active={w.active} labels={{ all: d.switcher.all, label: d.switcher.label }} />
      )}
      {sp.added && (
        <p role="status" className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          {c.added}
        </p>
      )}
      {adding && w.profileId && (
        <Card className="mb-6 border-chart-1/40">
          <CardContent className="grid gap-4 pt-6">
            <div>
              <h2 className="text-base font-semibold">
                {c.addTitle} · {name(w.active ?? "")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{c.addHint}</p>
            </div>
            <ManualBookingForm
              locale={locale}
              profileId={w.profileId}
              services={services.map((s) => ({ id: s.id, name: s.name, duration: s.durationMinutes }))}
              defaults={{
                day: typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today,
                time: typeof sp.time === "string" && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : "09:00",
              }}
              closeHref={href(w.days[0])}
              labels={{ service: c.service, serviceHint: c.serviceHint, day: c.day, time: c.time, duration: c.duration, guestName: c.guestName, guestPhone: c.guestPhone, price: c.price, note: c.note, save: c.save, cancel: c.cancel, errors: b.errors }}
            />
          </CardContent>
        </Card>
      )}
      <p className="mb-4 text-sm font-medium">
        {c.weekOf(dayLabel(w.days[0], { day: "numeric", month: "long" }), dayLabel(w.days[6], { day: "numeric", month: "long", year: "numeric" }))}
        {" · "}
        <span className="font-normal text-muted-foreground">
          {c.sessionNote(w.step)}
          {capacity > 1 && ` · ${c.capacityNote(capacity)}`}
        </span>
      </p>
      {!w.sessionSet && w.profileId && (
        <p className="-mt-2 mb-4 text-xs text-muted-foreground">
          {c.sessionUnset}{" "}
          <Link href={`/${locale}/dashboard/provider/profiles/${w.profileId}#hours`} className="text-chart-1 underline underline-offset-2">
            {c.sessionSetLink}
          </Link>
        </p>
      )}

      {/* Phones and tablets: an agenda, one block per day. */}
      <div className="grid gap-3 lg:hidden">
        {days.map((day) => {
          const list = events.filter((e) => e.date === day.date);
          return (
            <Card key={day.date} className={cn(day.date === today && "border-chart-1/50")}>
              <CardContent className="grid gap-3 pt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium">{dayLabel(day.date, { weekday: "long", day: "numeric", month: "long" })}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                    {day.ranges.length ? day.ranges.map((r) => `${hm(r.start)}-${hm(r.end)}`).join(" · ") : c.noHours}
                  </span>
                </div>
                {day.closures.map((x, i) => (
                  <p key={i} className="text-xs text-warning">
                    {x.isClosed ? c.closed : c.closure}
                    {x.note ? ` · ${x.note}` : ""}
                  </p>
                ))}
                {list.length > 0 && (
                  <ul className="divide-y divide-border">
                    {list.map((e) => (
                      <li key={e.id}>
                        <Link href={bookingHref(e.id)} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-white/3">
                          <span className="min-w-0">
                            <span className="block tabular-nums" dir="ltr">
                              {hm(e.start)}-{hm(algiersClock(e.endAt).minute)}
                            </span>
                            <span className="block truncate font-medium">
                              {e.source === "MANUAL" && <span className="text-chart-1">• </span>}
                              {clientLabel(e)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{e.serviceNameSnap}</span>
                          </span>
                          <StatusBadge status={e.status} labels={b.providerStatuses} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {w.profileId && (
                  <div className="flex flex-wrap gap-1.5">
                    {[...day.cells.entries()]
                      .filter(([, cell]) => cell.open)
                      .map(([m, cell]) => (
                        <Link key={m} href={addHref(day.date, hm(m))} className="rounded-full border border-dashed border-chart-1/40 px-2.5 py-1 text-xs tabular-nums text-chart-1 hover:bg-chart-1/10" dir="ltr" aria-label={c.freeSlot(`${dayLabel(day.date, { weekday: "long", day: "numeric" })} ${hm(m)}`)}>
                          + {hm(m)}
                          {cell.capacity > 1 && <span className="ms-1 opacity-70">{cell.capacity - cell.taken}</span>}
                        </Link>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop: one row per session, one cell per day. */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-border">
          <span />
          {days.map((day) => (
            <div key={day.date} className={cn("border-s border-border px-2 py-2.5 text-center", day.date === today && "bg-chart-1/8")}>
              <p className="text-xs text-muted-foreground">{dayLabel(day.date, { weekday: "short" })}</p>
              <p className={cn("text-lg font-semibold tabular-nums", day.date === today && "text-chart-1")}>{dayLabel(day.date, { day: "numeric" })}</p>
              {day.closures.length > 0 && <p className="mt-0.5 truncate text-[0.7rem] text-warning">{day.closures.some((x) => x.isClosed) ? c.closed : c.closure}</p>}
            </div>
          ))}
        </div>
        {rows.length === 0 && !hasOutside && <p className="p-6 text-sm text-muted-foreground">{c.noHoursWeek}</p>}
        {rows.map((m) => (
          <div key={m} className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-border/60 last:border-b-0">
            <span className="px-2 py-2 text-end text-[0.72rem] text-muted-foreground tabular-nums" dir="ltr">
              {hm(m)}
            </span>
            {days.map((day) => {
              const cell = day.cells.get(m);
              if (!cell) return <span key={day.date} className="border-s border-border bg-black/20" aria-hidden="true" />;
              return (
                <div key={day.date} className={cn("relative grid min-h-[3.25rem] content-start gap-1 border-s border-border p-1.5 pe-7", cell.taken >= cell.capacity && "bg-white/[0.03]")}>
                  {cell.starts.map(chip)}
                  {cell.taken > 0 && (
                    <span className="text-[0.65rem] text-muted-foreground tabular-nums" title={c.placesHint}>
                      {c.places(cell.taken, cell.capacity)}
                    </span>
                  )}
                  {cell.open && w.profileId && (
                    <Link
                      href={addHref(day.date, hm(m))}
                      aria-label={c.freeSlot(`${dayLabel(day.date, { weekday: "long", day: "numeric" })} ${hm(m)}`)}
                      className="absolute end-1 top-1 grid size-5 place-items-center rounded-md text-chart-1 opacity-60 hover:bg-chart-1/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Plus className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {hasOutside && (
          <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-t border-border bg-black/10">
            <span className="px-2 py-2 text-end text-[0.65rem] leading-tight text-muted-foreground">{c.outside}</span>
            {days.map((day) => (
              <div key={day.date} className="grid content-start gap-1 border-s border-border p-1.5">
                {day.outside.map((e) => (
                  <div key={e.id} className="grid gap-0.5">
                    <span className="text-[0.65rem] text-muted-foreground tabular-nums" dir="ltr">
                      {hm(e.start)}
                    </span>
                    {chip(e)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 hidden flex-wrap gap-3 text-xs text-muted-foreground lg:flex" aria-label={c.legend}>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-chart-1" aria-hidden="true">•</span>
          {c.manual}
        </span>
        {(["ACCEPTED", "PENDING", "RESCHEDULE_PROPOSED", "COMPLETED", "NO_SHOW"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", dot[s])} aria-hidden="true" />
            {b.providerStatuses[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <Plus className="size-3 text-chart-1" strokeWidth={2.25} aria-hidden="true" />
          {c.addHere}
        </span>
      </div>
      {events.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{c.empty}</p>}
    </div>
  );
}
