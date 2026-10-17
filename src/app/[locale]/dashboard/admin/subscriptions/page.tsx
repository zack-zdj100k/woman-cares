import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { canReview } from "@/server/policies/roles";
import { listSubscriptions, type SubscriptionFilter } from "@/server/services/billing";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { DataTable, FilterTabs, Pager, Td } from "@/components/dashboard/data-table";
import { RunCycleButton } from "@/components/dashboard/billing-forms";
import { Badge } from "@/components/ui/badge";

const FILTERS: SubscriptionFilter[] = ["all", "TRIALING", "ACTIVE", "GRACE", "EXPIRED", "EXEMPT", "NEGOTIATED"];

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.billing.adminTitle, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/subscriptions">) {
  return (
    <Subscriptions params={params} searchParams={searchParams} />
  );
}

async function Subscriptions({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/subscriptions">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/subscriptions`);
  const sp = await searchParams;
  const filter = (FILTERS as string[]).includes(String(sp.filter)) ? (sp.filter as SubscriptionFilter) : "all";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const [d, result] = await Promise.all([getDashboardDictionary(locale), listSubscriptions(user, filter, undefined, page)]);
  const b = d.billing;
  const base = `/${locale}/dashboard/admin/subscriptions`;
  const href = (f: string, p = 1) => `${base}?filter=${f}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className={pageClass}>
      <PageHeader
        title={b.adminTitle}
        description={b.adminDescription}
        actions={canReview(user) ? <RunCycleButton locale={locale} labels={{ run: b.runCycle, errors: b.errors }} /> : undefined}
      />
      <FilterTabs active={filter} items={FILTERS.map((f) => ({ key: f, label: b.filters[f], href: href(f) }))} />
      <DataTable head={[b.provider, b.status, b.basis, b.period, b.outstanding, ""]} empty={result.rows.length === 0 ? b.empty : undefined}>
        {result.rows.map((s) => {
          const due = s.invoices.reduce((sum, i) => sum + Number(i.total), 0);
          return (
            <tr key={s.id}>
              <Td>
                <span className="block font-medium">{s.provider.businessName}</span>
                <span className="block text-xs text-muted-foreground">{s.provider.user.email}</span>
              </Td>
              <Td>
                <Badge variant={s.status === "EXPIRED" ? "destructive" : s.status === "GRACE" ? "warning" : s.status === "EXEMPT" ? "outline" : "success"}>{b.statuses[s.status]}</Badge>
              </Td>
              <Td>
                {b.bases[s.billingBasis]}
                {s.negotiatedMonthlyPrice && <span className="block text-xs text-muted-foreground">{formatDzd(s.negotiatedMonthlyPrice.toString(), locale)}</span>}
              </Td>
              <Td className="text-muted-foreground">
                {s.status === "TRIALING" && s.trialEndsAt ? `${b.trialEnds} ${formatDate(s.trialEndsAt, locale, { dateStyle: "medium" })}` : s.currentPeriodEnd ? formatDate(s.currentPeriodEnd, locale, { dateStyle: "medium" }) : "-"}
              </Td>
              <Td className="tabular-nums">{due ? formatDzd(String(due), locale) : "-"}</Td>
              <Td>
                <Link href={`/${locale}/dashboard/admin/providers/${s.provider.id}`} className="text-sm text-chart-1 hover:underline">
                  {b.open}
                </Link>
              </Td>
            </tr>
          );
        })}
      </DataTable>
      <Pager page={page} pageCount={result.pageCount} href={(p) => href(filter, p)} labels={{ previous: "‹", next: "›" }} />
    </div>
  );
}
