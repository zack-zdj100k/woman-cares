import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getAdminDictionary, getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { canViewAudit } from "@/server/policies/roles";
import { getAdminOverview } from "@/server/services/admin-overview";
import { queueCounts } from "@/server/services/review";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.adminOverview.title, robots: { index: false } };
}

export default async function AdminDashboardPage() {
  const locale = await getLocale();
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboard locale={locale} />
    </Suspense>
  );
}

async function AdminDashboard({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin`);
  const [d, at, o, q] = await Promise.all([getDashboardDictionary(locale), getAdminDictionary(locale), getAdminOverview(user), queueCounts(user)]);
  const c = d.adminOverview;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-FR", { numberingSystem: "latn" } as Intl.NumberFormatOptions);
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const series = o.series.map((s) => ({ ...s, label: dayFmt.format(new Date(`${s.week}T12:00:00Z`)) }));
  const queue = [
    { label: c.queueItems.profiles, value: q.profiles },
    { label: c.queueItems.requests, value: q.requests },
    { label: c.queueItems.credentials, value: q.credentials },
  ];

  return (
    <div className={pageClass}>
      <PageHeader title={c.title} description={c.description} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="users" label={c.stats.clients} value={nf.format(o.clients)} />
        <StatCard icon="profiles" label={c.stats.providers} value={nf.format(o.providers)} />
        <StatCard icon="providers" label={c.stats.published} value={nf.format(o.published)} />
        <StatCard icon="appointments" label={c.stats.bookings} value={nf.format(o.bookingsMonth)} hint={c.stats.pending(o.pendingBookings)} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{c.trend}</CardTitle>
          <CardDescription>{c.trendDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={series}
            xKey="label"
            rtl={locale === "ar"}
            series={[
              { key: "bookings", label: c.series.bookings, color: "var(--chart-1)" },
              { key: "clients", label: c.series.clients, color: "var(--chart-2)" },
              { key: "providers", label: c.series.providers, color: "var(--chart-3)" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>{c.queue}</CardTitle>
              <CardDescription>{q.providers === 0 ? c.queueEmpty : at.overview.queueCounts(q.providers, q.profiles, q.requests, q.credentials)}</CardDescription>
            </div>
            <Link href={`/${locale}/dashboard/admin/providers`} className={buttonClass({ variant: "solid", size: "sm", className: "shrink-0" })}>
              {c.openQueue}
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {queue.map((item) => (
                <li key={item.label} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <Badge variant={item.value ? "rose" : "outline"}>{nf.format(item.value)}</Badge>
                </li>
              ))}
              <li className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted-foreground">{c.stats.support(o.openSupport)}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <CardTitle>{c.activity}</CardTitle>
              <CardDescription>{c.activityDescription}</CardDescription>
            </div>
            {canViewAudit(user) && (
              <Link href={`/${locale}/dashboard/admin/audit-logs`} className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                {c.allLogs}
                <ArrowUpRight className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {o.audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.activityEmpty}</p>
            ) : (
              <ol className="grid gap-4">
                {o.audit.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[0.7rem] font-semibold" aria-hidden="true">
                      {(a.actor ?? c.system)
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{a.actor ?? c.system}</span> <span className="text-muted-foreground">{at.audit[a.action] ?? a.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.at, locale, { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
