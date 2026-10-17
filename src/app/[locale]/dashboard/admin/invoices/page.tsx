import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { listInvoices } from "@/server/services/billing";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { DataTable, FilterTabs, Pager, Td } from "@/components/dashboard/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";

const FILTERS = ["all", "OPEN", "OVERDUE", "PAID", "VOID"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.billing.invoicesAdminTitle, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/invoices">) {
  return (
    <Invoices params={params} searchParams={searchParams} />
  );
}

async function Invoices({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/invoices">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/invoices`);
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof FILTERS)[number]) : "all";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const [d, result] = await Promise.all([getDashboardDictionary(locale), listInvoices(user, status, page)]);
  const b = d.billing;
  const base = `/${locale}/dashboard/admin/invoices`;
  const href = (s: string, p = 1) => `${base}?status=${s}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className={pageClass}>
      <PageHeader title={b.invoicesAdminTitle} description={b.invoicesAdminDescription} />
      <div className="mb-6 grid gap-4 sm:max-w-sm">
        <StatCard icon="payments" label={b.collected} value={formatDzd(result.collected, locale)} />
      </div>
      <FilterTabs active={status} items={FILTERS.map((f) => ({ key: f, label: f === "all" ? b.filters.all : b.invoiceStatuses[f], href: href(f) }))} />
      <DataTable head={[b.number, b.provider, b.periodCol, b.amount, b.due, b.status]} empty={result.rows.length === 0 ? b.noInvoices : undefined}>
        {result.rows.map((i) => (
          <tr key={i.id}>
            <Td>
              <span dir="ltr" className="font-medium">
                {i.number}
              </span>
            </Td>
            <Td>
              <Link href={`/${locale}/dashboard/admin/providers/${i.provider.id}`} className="hover:underline">
                {i.provider.businessName}
              </Link>
            </Td>
            <Td className="text-muted-foreground">
              {formatDate(i.periodStart, locale, { dateStyle: "medium" })} – {formatDate(i.periodEnd, locale, { dateStyle: "medium" })}
            </Td>
            <Td className="tabular-nums">{formatDzd(i.total.toString(), locale)}</Td>
            <Td className="text-muted-foreground">{formatDate(i.dueAt, locale, { dateStyle: "medium" })}</Td>
            <Td>
              <Badge variant={i.status === "PAID" ? "success" : i.status === "OVERDUE" ? "destructive" : i.status === "VOID" ? "outline" : "warning"}>{b.invoiceStatuses[i.status]}</Badge>
            </Td>
          </tr>
        ))}
      </DataTable>
      <Pager page={page} pageCount={result.pageCount} href={(p) => href(status, p)} labels={{ previous: "‹", next: "›" }} />
    </div>
  );
}
