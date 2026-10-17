import type { Metadata } from "next";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import type { PeriodKey } from "@/lib/periods";
import { getProviderAnalytics } from "@/server/services/provider-insights";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { CategorySwitcher } from "@/components/dashboard/category-switcher";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { BarList } from "@/components/dashboard/bar-list";
import { DataTable, Td } from "@/components/dashboard/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.analytics.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/analytics">) {
  return (
    <Analytics params={params} searchParams={searchParams} />
  );
}

async function Analytics({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/analytics">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/analytics`);
  const sp = await searchParams;
  const period: PeriodKey = sp.period === "week" || sp.period === "year" ? sp.period : "month";
  const [d, site, a] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), getProviderAnalytics(user, { category: typeof sp.category === "string" ? sp.category : undefined, period })]);
  const c = d.analytics;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const intl = locale === "ar" ? "ar-DZ" : "fr-FR";
  const nf = new Intl.NumberFormat(intl, { numberingSystem: "latn" } as Intl.NumberFormatOptions);
  const pct = (v: number | null) => (v === null ? c.noData : new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 1, numberingSystem: "latn" } as Intl.NumberFormatOptions).format(v));
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const base = `/${locale}/dashboard/provider/analytics`;
  const f = a.funnel;
  const steps = (["views", "requests", "answered", "accepted", "completed"] as const).map((k) => ({ key: k, value: f[k] }));
  const top = Math.max(1, ...steps.map((s) => s.value));
  const rateKeys = ["conversion", "acceptance", "expiry", "noShow", "cancellation"] as const;

  return (
    <div className={pageClass}>
      <PageHeader title={c.title} description={c.description} />
      <CategorySwitcher
        base={base}
        categories={a.categories.map((x) => ({ slug: x, name: name(x) }))}
        active={a.active}
        period={period}
        labels={{ all: d.switcher.all, label: d.switcher.label, periods: d.switcher.periods, periodLabel: d.switcher.periodLabel }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {rateKeys.map((k) => (
          <Card key={k}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.rates[k]}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={a.rates[k] === null ? "text-base text-muted-foreground" : "text-2xl font-semibold tabular-nums tracking-tight"}>{pct(a.rates[k])}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.ratesHint[k]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{c.funnel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {steps.map((s) => (
                <li key={s.key} className="grid gap-1 text-sm">
                  <span className="flex justify-between gap-3">
                    <span>{c.funnelSteps[s.key]}</span>
                    <span className="tabular-nums font-medium">{nf.format(s.value)}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/6" aria-hidden="true">
                    <span className="block h-full rounded-full bg-chart-1" style={{ width: `${s.value ? Math.max(2, (s.value / top) * 100) : 0}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c.trend}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={a.series.map((w) => ({ ...w, label: dayFmt.format(new Date(`${w.week}T12:00:00Z`)) }))}
              xKey="label"
              rtl={locale === "ar"}
              height={240}
              series={[
                { key: "requests", label: d.providerOverview.series.requests, color: "var(--chart-1)" },
                { key: "views", label: d.providerOverview.series.views, color: "var(--chart-2)" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{c.services}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList empty={c.servicesEmpty} rows={a.services.map((s) => ({ key: s.name, label: s.name, value: s.count, display: c.bookingsCount(s.count) }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c.weekdays}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList empty={c.busyEmpty} rows={a.weekdays.map((w) => ({ key: String(w.weekday), label: c.weekdayNames[w.weekday], value: w.count, display: nf.format(w.count) }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c.hours}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList empty={c.busyEmpty} rows={a.hours.map((h) => ({ key: String(h.hour), label: `${String(h.hour).padStart(2, "0")}:00`, value: h.count, display: nf.format(h.count) }))} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <h2 className="mb-3 text-base font-semibold">{c.perCategory}</h2>
          <DataTable head={[c.columns.category, c.columns.views, c.columns.requests, c.columns.conversion]}>
            {a.perCategory.map((r) => (
              <tr key={r.category}>
                <Td className="font-medium">{name(r.category)}</Td>
                <Td className="tabular-nums">{nf.format(r.views)}</Td>
                <Td className="tabular-nums">{nf.format(r.requests)}</Td>
                <Td className="tabular-nums text-muted-foreground">{pct(r.conversion)}</Td>
              </tr>
            ))}
          </DataTable>
        </div>
        <Card className="content-start">
          <CardHeader>
            <CardTitle>{c.outcomes}</CardTitle>
            <CardDescription>{d.switcher.periods[period]}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              {(Object.keys(c.outcomeLabels) as (keyof typeof c.outcomeLabels)[]).map((k) => (
                <div key={k} className="flex justify-between gap-3 py-2">
                  <dt>{c.outcomeLabels[k]}</dt>
                  <dd className="tabular-nums font-medium">{nf.format(a.outcomes[k])}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
