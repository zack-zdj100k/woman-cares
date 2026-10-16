import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { listClientBookings, type ClientBookingFilter } from "@/server/services/bookings";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { DataTable, FilterTabs, Pager, Td } from "@/components/dashboard/data-table";
import { priceRange, StatusBadge, when } from "@/components/dashboard/booking-ui";
import { FindCareButton } from "@/components/marketing/find-care-button";

const FILTERS: ClientBookingFilter[] = ["upcoming", "pending", "past", "all"];

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.bookings.appointments, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/client/appointments">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Appointments params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Appointments({ params, searchParams }: PageProps<"/[locale]/dashboard/client/appointments">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "client", `/${locale}/dashboard/client/appointments`);
  const sp = await searchParams;
  const filter = FILTERS.includes(sp.filter as ClientBookingFilter) ? (sp.filter as ClientBookingFilter) : "all";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const [d, site, result] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), listClientBookings(user, filter, page)]);
  const b = d.bookings;
  const base = `/${locale}/dashboard/client/appointments`;
  const href = (f: string, p = 1) => `${base}?filter=${f}${p > 1 ? `&page=${p}` : ""}`;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;

  return (
    <div className={pageClass}>
      <PageHeader title={b.appointments} description={b.appointmentsDescription} actions={<FindCareButton label={b.bookAgain} variant="solid" />} />
      <FilterTabs active={filter} items={FILTERS.map((f) => ({ key: f, label: b.clientFilters[f], href: href(f) }))} />
      <DataTable
        head={[b.columns.when, b.columns.professional, b.columns.service, b.columns.price, b.columns.status, b.columns.reference]}
        empty={result.rows.length === 0 ? b.clientEmpty[filter] : undefined}
      >
        {result.rows.map((r) => (
          <tr key={r.id} className="hover:bg-white/3">
            <Td className="whitespace-nowrap tabular-nums">
              <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
                {when(r.startAt, locale)}
              </Link>
              {r.status === "RESCHEDULE_PROPOSED" && r.proposedStartAt && (
                <span className="block text-xs text-chart-1">
                  {b.proposed} : {when(r.proposedStartAt, locale)}
                </span>
              )}
            </Td>
            <Td>
              <span className="block font-medium">{r.profile.provider.businessName}</span>
              <span className="block text-xs text-muted-foreground">{name(r.profile.category.slug)}</span>
            </Td>
            <Td>
              {r.serviceNameSnap}
              <span className="block text-xs text-muted-foreground">{b.minutes(r.durationMinSnap)}</span>
            </Td>
            <Td className="whitespace-nowrap tabular-nums">{priceRange(r.priceMinSnap, r.priceMaxSnap, locale)}</Td>
            <Td>
              <StatusBadge status={r.status} labels={b.clientStatuses} />
            </Td>
            <Td className="text-xs text-muted-foreground">
              <Link href={`${base}/${r.id}`} className="hover:text-foreground" dir="ltr">
                {r.reference}
              </Link>
            </Td>
          </tr>
        ))}
      </DataTable>
      <Pager page={page} pageCount={result.pageCount} href={(p) => href(filter, p)} labels={{ previous: b.previous, next: b.next }} />
    </div>
  );
}
