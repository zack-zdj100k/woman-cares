import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { canReview } from "@/server/policies/roles";
import { listPayments } from "@/server/services/billing";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { DataTable, FilterTabs, Pager, Td } from "@/components/dashboard/data-table";
import { VerifyPaymentForm } from "@/components/dashboard/billing-forms";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { Badge } from "@/components/ui/badge";

const FILTERS = ["PENDING", "PAID", "FAILED", "all"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.billing.paymentsTitle, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/payments">) {
  return (
    <Payments params={params} searchParams={searchParams} />
  );
}

async function Payments({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/payments">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/payments`);
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof FILTERS)[number]) : "PENDING";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const [d, result] = await Promise.all([getDashboardDictionary(locale), listPayments(user, status, page)]);
  const b = d.billing;
  const base = `/${locale}/dashboard/admin/payments`;
  const href = (s: string, p = 1) => `${base}?status=${s}${p > 1 ? `&page=${p}` : ""}`;
  const decide = canReview(user);

  return (
    <div className={pageClass}>
      <PageHeader title={b.paymentsTitle} description={b.paymentsDescription} />
      <FilterTabs
        active={status}
        items={FILTERS.map((f) => ({ key: f, label: f === "all" ? b.filters.all : b.paymentStatuses[f], href: href(f) }))}
      />
      <DecisionFeedback>
        <DataTable head={[b.provider, b.number, b.amount, b.method, b.declaredOn, b.status, ""]} empty={result.rows.length === 0 ? b.noPayments : undefined}>
          {result.rows.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link href={`/${locale}/dashboard/admin/providers/${p.invoice.provider.id}`} className="font-medium hover:underline">
                  {p.invoice.provider.businessName}
                </Link>
              </Td>
              <Td>
                <span dir="ltr">{p.invoice.number}</span>
              </Td>
              <Td className="tabular-nums">{formatDzd(p.amount.toString(), locale)}</Td>
              <Td>
                {b.methods[p.method]}
                <span className="block text-xs text-muted-foreground" dir="ltr">
                  {p.externalReference}
                </span>
                {p.note && <span className="block max-w-[16rem] text-xs text-muted-foreground">{p.note}</span>}
              </Td>
              <Td className="text-muted-foreground">{formatDate(p.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</Td>
              <Td>
                <Badge variant={p.status === "PAID" ? "success" : p.status === "FAILED" ? "destructive" : "warning"}>{b.paymentStatuses[p.status]}</Badge>
                {p.verifiedBy && <span className="mt-1 block text-xs text-muted-foreground">{b.verifiedBy} {p.verifiedBy.fullName}</span>}
              </Td>
              <Td>
                {decide && p.status === "PENDING" && (
                  <VerifyPaymentForm paymentId={p.id} labels={{ verify: b.verify, refuse: b.refuse, reason: b.refuseReason, done: b.saved, errors: b.errors }} />
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
      </DecisionFeedback>
      <Pager page={page} pageCount={result.pageCount} href={(p) => href(status, p)} labels={{ previous: "‹", next: "›" }} />
    </div>
  );
}
