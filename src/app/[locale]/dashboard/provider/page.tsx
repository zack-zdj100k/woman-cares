import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getAuthDictionary, getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import type { PeriodKey } from "@/lib/periods";
import { getProviderOverview } from "@/server/services/provider-overview";
import { UnverifiedBanner } from "@/components/dashboard/unverified-banner";
import { CategorySwitcher } from "@/components/dashboard/category-switcher";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Badge } from "@/components/ui/badge";
import { clientLabel } from "@/lib/booking-rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.account.space, robots: { index: false } };
}

export default function ProviderDashboardPage({ params, searchParams }: PageProps<"/[locale]/dashboard/provider">) {
  return (
    <ProviderDashboard params={params} searchParams={searchParams} />
  );
}

async function ProviderDashboard({ params, searchParams }: PageProps<"/[locale]/dashboard/provider">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider`);
  const sp = await searchParams;
  const period: PeriodKey = sp.period === "week" || sp.period === "year" ? sp.period : "month";
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const [t, d, site, o] = await Promise.all([getAuthDictionary(locale), getDashboardDictionary(locale), getDictionary(locale), getProviderOverview(user, { category, period })]);
  const c = d.providerOverview;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { numberingSystem: "latn" } as Intl.NumberFormatOptions);
  const pct = (v: number) => new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { style: "percent", maximumFractionDigits: 1, numberingSystem: "latn" } as Intl.NumberFormatOptions).format(v);
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const base = `/${locale}/dashboard/provider`;
  const s = o.stats;

  return (
    <div className={pageClass}>
      {!user.emailVerified && <UnverifiedBanner locale={locale} t={t} />}
      <PageHeader
        title={c.welcome(user.fullName.split(" ")[0])}
        description={c.description}
        actions={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{o.account.businessName}</span>
            <Badge variant={o.account.status === "APPROVED" ? "success" : o.account.status === "PENDING_REVIEW" || o.account.status === "ONBOARDING" ? "warning" : "destructive"}>
              {t.dashboard.provider.statuses[o.account.status]}
            </Badge>
          </span>
        }
      />
      <CategorySwitcher
        base={base}
        categories={o.profiles.map((p) => ({ slug: p.category, name: name(p.category) }))}
        active={o.category}
        period={period}
        labels={{ all: d.switcher.all, label: d.switcher.label, periods: d.switcher.periods, periodLabel: d.switcher.periodLabel }}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="appointments" label={c.stats.bookings} value={nf.format(s.bookings)} hint={c.stats.delta(s.bookingsDelta)} />
        <StatCard icon="bookings" label={c.stats.pending} value={nf.format(s.pending)} hint={c.stats.upcoming(s.upcoming)} />
        <StatCard icon="earnings" label={c.stats.revenue} value={formatDzd(String(s.revenue), locale)} hint={c.stats.completed(s.completed)} />
        <StatCard
          icon="analytics"
          label={c.stats.views}
          value={nf.format(s.views)}
          hint={s.conversion === null ? c.stats.noConversion : c.stats.conversion(pct(s.conversion))}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{c.trend}</CardTitle>
          <CardDescription>{c.trendDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={o.series.map((w) => ({ ...w, label: dayFmt.format(new Date(`${w.week}T12:00:00Z`)) }))}
            xKey="label"
            rtl={locale === "ar"}
            series={[
              { key: "requests", label: c.series.requests, color: "var(--chart-1)" },
              { key: "views", label: c.series.views, color: "var(--chart-2)" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle>{c.next}</CardTitle>
            <Link href={`${base}/bookings`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              {c.seeAll}
              <ArrowUpRight className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            </Link>
          </CardHeader>
          <CardContent>
            {o.nextAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.nextEmpty}</p>
            ) : (
              <ul className="divide-y divide-border">
                {o.nextAppointments.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{clientLabel(b)}</span>
                      <span className="block truncate text-muted-foreground">
                        {b.serviceNameSnap} · {name(b.profile.category.slug)}
                      </span>
                    </span>
                    <span className="shrink-0 text-end tabular-nums">{formatDate(b.startAt, locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{c.activity}</CardTitle>
          </CardHeader>
          <CardContent>
            {o.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.activityEmpty}</p>
            ) : (
              <ol className="grid gap-4">
                {o.activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[0.7rem] font-semibold" aria-hidden="true">
                      {clientLabel(a.booking)
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p>
                        <span className="font-medium">{clientLabel(a.booking)}</span> <span className="text-muted-foreground">· {a.booking.serviceNameSnap}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.statuses[a.toStatus]} · {formatDate(a.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle>{c.profiles}</CardTitle>
            <Link href={`${base}/profiles`} className="text-sm text-muted-foreground hover:text-foreground">
              {c.seeAll}
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {o.profiles.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{name(p.category)}</span>
                  <Badge variant={p.status === "PUBLISHED" ? "success" : p.status === "PENDING_REVIEW" ? "warning" : "outline"}>{t.dashboard.provider.profileStatuses[p.status]}</Badge>
                </li>
              ))}
            </ul>
            {o.pendingCategories.length > 0 && (
              <div className="mt-4 border-t border-border pt-4 text-sm">
                <p className="text-muted-foreground">{t.dashboard.provider.requests}</p>
                <p className="mt-1">{o.pendingCategories.map(name).join(", ")}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle>{c.subscription}</CardTitle>
            <Link href={`${base}/subscriptions`} className="text-sm text-muted-foreground hover:text-foreground">
              {c.seeAll}
            </Link>
          </CardHeader>
          <CardContent className="text-sm">
            {o.subscription ? (
              <>
                <Badge variant={o.subscription.status === "EXPIRED" ? "destructive" : o.subscription.status === "GRACE" ? "warning" : "success"}>{d.billing.statuses[o.subscription.status]}</Badge>
                <p className="mt-3 text-muted-foreground">{d.billing.bases[o.subscription.billingBasis]}</p>
                {o.subscription.status === "TRIALING" && o.subscription.trialEndsAt && (
                  <p className="mt-1 text-muted-foreground">
                    {d.billing.trialEnds} {formatDate(o.subscription.trialEndsAt, locale)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">{d.billing.noSubscription}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
