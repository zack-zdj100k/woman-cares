import type { Metadata } from "next";
import Link from "next/link";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import type { PeriodKey } from "@/lib/periods";
import { getProviderEarnings } from "@/server/services/provider-insights";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { CategorySwitcher } from "@/components/dashboard/category-switcher";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { BarList } from "@/components/dashboard/bar-list";
import { DataTable, Td } from "@/components/dashboard/data-table";
import { priceRange, when } from "@/components/dashboard/booking-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.earnings.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/earnings">) {
  return <Earnings params={params} searchParams={searchParams} />;
}

async function Earnings({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/earnings">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/earnings`);
  const sp = await searchParams;
  const period: PeriodKey = sp.period === "week" || sp.period === "year" ? sp.period : "month";
  const [d, site, e] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), getProviderEarnings(user, { category: typeof sp.category === "string" ? sp.category : undefined, period })]);
  const c = d.earnings;
  const b = d.bookings;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const dzd = (n: number) => formatDzd(String(Math.round(n * 100) / 100), locale);
  const monthFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { month: "short", timeZone: "UTC" });
  const s = e.stats;
  const base = `/${locale}/dashboard/provider/earnings`;

  return (
    <div className={pageClass}>
      <PageHeader title={c.title} description={c.description} />
      <CategorySwitcher
        base={base}
        categories={e.categories.map((x) => ({ slug: x, name: name(x) }))}
        active={e.active}
        period={period}
        labels={{ all: d.switcher.all, label: d.switcher.label, periods: d.switcher.periods, periodLabel: d.switcher.periodLabel }}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="earnings" label={c.stats.net} value={dzd(s.net)} hint={s.netDelta === 0 ? c.stats.same : c.stats.delta(`${s.netDelta > 0 ? "+" : "-"}${dzd(Math.abs(s.netDelta))}`)} />
        <StatCard icon="payments" label={c.stats.paid} value={dzd(s.paid)} hint={c.stats.paidHint(s.paidCount)} />
        <StatCard icon="invoices" label={c.stats.average} value={s.average === null ? "-" : dzd(s.average)} hint={s.average === null ? c.stats.averageNone : undefined} />
        <StatCard icon="bookings" label={c.stats.unpaid} value={s.unpaid} hint={s.refunded ? `${c.stats.refunded} : ${dzd(s.refunded)}` : undefined} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{c.trend}</CardTitle>
          <CardDescription>{c.trendDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={e.series.map((m) => ({ ...m, label: monthFmt.format(new Date(`${m.month}-15T12:00:00Z`)) }))}
            xKey="label"
            rtl={locale === "ar"}
            money={{ locale: locale === "ar" ? "ar-DZ" : "fr-FR", currency: "DZD" }}
            series={[{ key: "net", label: c.series, color: "var(--chart-1)" }]}
          />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{c.byCategory}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList empty={c.none} rows={e.byCategory.map((r) => ({ key: r.category, label: name(r.category), value: r.amount, display: dzd(r.amount) }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c.byMethod}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList empty={c.none} rows={e.byMethod.map((r) => ({ key: r.method, label: b.methods[r.method] ?? r.method, value: r.amount, display: dzd(r.amount) }))} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{c.unpaidTitle}</CardTitle>
          <CardDescription>{c.unpaidHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {e.unpaid.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.unpaidEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {e.unpaid.map((u) => (
                <li key={u.id}>
                  <Link href={`/${locale}/dashboard/provider/bookings/${u.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm hover:bg-white/3">
                    <span className="min-w-0">
                      <span className="block font-medium">{u.client.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {u.serviceNameSnap} · {when(u.startAt, locale)}
                      </span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">{priceRange(u.priceMinSnap, u.priceMaxSnap, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 text-base font-semibold">{c.recent}</h2>
      <DataTable head={[b.columns.when, b.columns.client, b.columns.service, d.billing.method, d.billing.amount]} empty={e.recent.length === 0 ? c.recentEmpty : undefined}>
        {e.recent.map((p) => (
          <tr key={p.id} className="hover:bg-white/3">
            <Td className="whitespace-nowrap tabular-nums">{formatDate(p.recordedAt, locale, { dateStyle: "medium" })}</Td>
            <Td>
              <Link href={`/${locale}/dashboard/provider/bookings/${p.booking.id}`} className="font-medium hover:underline">
                {p.booking.client.fullName}
              </Link>
              <span className="block text-xs text-muted-foreground" dir="ltr">
                {p.booking.reference}
              </span>
            </Td>
            <Td>
              {p.booking.serviceNameSnap}
              <span className="block text-xs text-muted-foreground">{name(p.booking.profile.category.slug)}</span>
            </Td>
            <Td>{p.status === "REFUNDED" ? c.refund : (b.methods[p.method ?? ""] ?? p.method)}</Td>
            <Td className={p.status === "REFUNDED" ? "whitespace-nowrap tabular-nums text-destructive" : "whitespace-nowrap tabular-nums"}>
              {p.status === "REFUNDED" ? "-" : ""}
              {formatDzd(p.amount.toString(), locale)}
            </Td>
          </tr>
        ))}
      </DataTable>
      <p className="mt-4 text-xs text-muted-foreground">
        <Link href={`/${locale}/dashboard/provider/invoices`} className="hover:text-foreground">
          {c.subscriptionNote}
        </Link>
      </p>
    </div>
  );
}
