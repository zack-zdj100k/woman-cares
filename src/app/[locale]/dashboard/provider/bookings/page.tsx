import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { listProviderBookingTable, providerCategories, type ProviderBookingFilter } from "@/server/services/booking-views";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { CategorySwitcher } from "@/components/dashboard/category-switcher";
import { DataTable, FilterTabs, Pager, Td } from "@/components/dashboard/data-table";
import { priceRange, StatusBadge, when } from "@/components/dashboard/booking-ui";
import { Input } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";

const FILTERS: ProviderBookingFilter[] = ["pending", "today", "upcoming", "past", "cancelled", "all"];

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.bookings.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/bookings">) {
  return (
    <Bookings params={params} searchParams={searchParams} />
  );
}

async function Bookings({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/bookings">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/bookings`);
  const sp = await searchParams;
  const filter = FILTERS.includes(sp.filter as ProviderBookingFilter) ? (sp.filter as ProviderBookingFilter) : "pending";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const cats = await providerCategories(user);
  const category = typeof sp.category === "string" && cats.includes(sp.category) ? sp.category : undefined;
  const [d, site, result] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), listProviderBookingTable(user, { filter, category, q, page })]);
  const b = d.bookings;
  const base = `/${locale}/dashboard/provider/bookings`;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const href = (f: string, p = 1) => {
    const u = new URLSearchParams({ filter: f });
    if (category) u.set("category", category);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    return `${base}?${u}`;
  };
  const count = (f: ProviderBookingFilter) => (f in result.counts ? result.counts[f as keyof typeof result.counts] : null);

  return (
    <div className={pageClass}>
      <PageHeader title={b.title} description={b.description} />
      {cats.length > 1 && <CategorySwitcher base={base} keep={{ filter }} categories={cats.map((c) => ({ slug: c, name: name(c) }))} active={category ?? null} labels={{ all: d.switcher.all, label: d.switcher.label }} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterTabs
          active={filter}
          items={FILTERS.map((f) => {
            const n = count(f);
            return { key: f, label: n ? `${b.providerFilters[f]} · ${n}` : b.providerFilters[f], href: href(f) };
          })}
        />
        <form action={base} className="mb-5 flex gap-2" role="search">
          <input type="hidden" name="filter" value={filter} />
          {category && <input type="hidden" name="category" value={category} />}
          <label className="sr-only" htmlFor="booking-q">
            {b.search}
          </label>
          <Input id="booking-q" name="q" defaultValue={q} placeholder={b.search} className="h-9 w-[16rem]" />
          <button type="submit" className={buttonClass({ variant: "outline", size: "icon" })} aria-label={b.searchButton}>
            <Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </form>
      </div>
      <DataTable
        head={[b.columns.when, b.columns.client, b.columns.service, b.columns.price, b.columns.status, b.columns.payment, ""]}
        empty={result.rows.length === 0 ? b.providerEmpty[filter] : undefined}
      >
        {result.rows.map((r) => (
          <tr key={r.id} className="hover:bg-white/3">
            <Td className="whitespace-nowrap tabular-nums">
              <span className="font-medium">{when(r.startAt, locale)}</span>
              {r.status === "RESCHEDULE_PROPOSED" && r.proposedStartAt && (
                <span className="block text-xs text-chart-1">
                  {b.proposed} : {when(r.proposedStartAt, locale)}
                </span>
              )}
            </Td>
            <Td>
              <span className="block font-medium">{r.client.fullName}</span>
              <span className="block text-xs text-muted-foreground" dir="ltr">
                {r.reference}
              </span>
            </Td>
            <Td>
              {r.serviceNameSnap}
              <span className="block text-xs text-muted-foreground">
                {name(r.profile.category.slug)} · {b.minutes(r.durationMinSnap)}
              </span>
            </Td>
            <Td className="whitespace-nowrap tabular-nums">{priceRange(r.priceMinSnap, r.priceMaxSnap, locale)}</Td>
            <Td>
              <StatusBadge status={r.status} labels={b.providerStatuses} />
            </Td>
            <Td className="text-muted-foreground">{b.paymentStatuses[r.paymentStatus]}</Td>
            <Td className="text-end">
              <Link href={`${base}/${r.id}`} className={buttonClass({ variant: r.status === "PENDING" ? "solid" : "outline", size: "sm" })}>
                {b.open}
              </Link>
            </Td>
          </tr>
        ))}
      </DataTable>
      <Pager page={page} pageCount={result.pageCount} href={(p) => href(filter, p)} labels={{ previous: b.previous, next: b.next }} />
    </div>
  );
}
