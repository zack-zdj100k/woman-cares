import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getClientOverview } from "@/server/services/client-overview";
import { UnverifiedBanner } from "@/components/dashboard/unverified-banner";
import { FindCareButton } from "@/components/marketing/find-care-button";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.account.space, robots: { index: false } };
}

export default async function ClientDashboardPage() {
  const locale = await getLocale();
  return (
    <ClientDashboard locale={locale} />
  );
}

type Row = { id: string; reference: string; startAt: Date; status: string; serviceNameSnap: string; profile: { slug: string; category: { slug: string }; provider: { businessName: string } } };

async function ClientDashboard({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "client", `/${locale}/dashboard/client`);
  const [t, d, site, o] = await Promise.all([getAuthDictionary(locale), getDashboardDictionary(locale), getDictionary(locale), getClientOverview(user)]);
  const c = d.clientOverview;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const when = (at: Date) => formatDate(at, locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const list = (rows: Row[], empty: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y divide-border">
        {rows.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <Link href={`/${locale}/dashboard/client/appointments/${b.id}`} className="block truncate font-medium hover:underline">
                {b.profile.provider.businessName}
              </Link>
              <span className="block truncate text-muted-foreground">
                {b.serviceNameSnap} · {name(b.profile.category.slug)}
              </span>
            </span>
            <span className="shrink-0 text-end tabular-nums">{when(b.startAt)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className={pageClass}>
      {!user.emailVerified && <UnverifiedBanner locale={locale} t={t} />}
      <PageHeader title={c.welcome(user.fullName.split(" ")[0])} description={c.description} actions={<FindCareButton label={c.explore} variant="solid" />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="appointments" label={c.stats.upcoming} value={o.counts.upcoming} />
        <StatCard icon="bookings" label={c.stats.awaiting} value={o.counts.awaiting} />
        <StatCard icon="reviews" label={c.stats.completed} value={o.counts.completed} />
        <StatCard icon="favorites" label={c.stats.favorites} value={o.counts.favorites} />
      </div>

      {o.action.length > 0 && (
        <Card className="mt-6 border-warning/40">
          <CardHeader>
            <CardTitle>{c.action}</CardTitle>
            <p className="text-sm text-muted-foreground">{c.actionHint}</p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {o.action.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <Link href={`/${locale}/dashboard/client/appointments/${b.id}`} className="block font-medium hover:underline">
                      {b.profile.provider.businessName}
                    </Link>
                    <span className="block text-muted-foreground">{b.serviceNameSnap}</span>
                  </span>
                  {b.proposedStartAt && (
                    <span className="text-end">
                      <span className="block text-xs text-muted-foreground">{c.proposed}</span>
                      <span className="tabular-nums">{when(b.proposedStartAt)}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{c.upcoming}</CardTitle>
          </CardHeader>
          <CardContent>{list(o.upcoming, c.upcomingEmpty)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{c.awaiting}</CardTitle>
          </CardHeader>
          <CardContent>{list(o.awaiting, c.awaitingEmpty)}</CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{c.favorites}</CardTitle>
          </CardHeader>
          <CardContent>
            {o.favorites.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Heart className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {c.favoritesEmpty}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {o.favorites.map((f) => (
                  <li key={f.slug}>
                    {f.available ? (
                      <Link href={`/${locale}/profiles/${f.slug}`} className="group block">
                        <span className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                          {f.imageUrl && <Image src={f.imageUrl} alt="" fill sizes="12rem" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                        </span>
                        <span className="mt-2 block truncate text-sm font-medium">{f.name}</span>
                        <span className="block text-xs text-muted-foreground">{name(f.category)}</span>
                      </Link>
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{c.unavailable}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <CardTitle>{c.notifications}</CardTitle>
            <Link href={`/${locale}/dashboard/client/notifications`} className="text-sm text-muted-foreground hover:text-foreground">
              {c.seeAll}
            </Link>
          </CardHeader>
          <CardContent>
            {o.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">{c.notificationsEmpty}</p>
            ) : (
              <ul className="grid gap-3">
                {o.notifications.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {!n.readAt && <Badge variant="rose" className="px-1.5 py-0">•</Badge>}
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(n.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
