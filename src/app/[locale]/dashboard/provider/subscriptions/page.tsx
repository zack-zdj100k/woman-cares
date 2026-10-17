import type { Metadata } from "next";
import Link from "next/link";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { getMyBilling } from "@/server/services/billing";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { InvoiceList } from "@/components/dashboard/invoice-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.billing.title, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/provider/subscriptions">) {
  return (
    <Billing params={params} />
  );
}

async function Billing({ params }: { params: PageProps<"/[locale]/dashboard/provider/subscriptions">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/subscriptions`);
  const [d, site, data] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), getMyBilling(user)]);
  const b = d.billing;
  const sub = data.subscription;
  const name = (slug: string) => site.categories[slug as CategorySlug]?.name ?? slug;
  const restricted = sub && (sub.status === "EXPIRED" || sub.status === "SUSPENDED");

  return (
    <div className={pageClass}>
      <PageHeader title={b.title} description={b.description} />
      {restricted && <p className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{b.restricted}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{b.status}</CardTitle>
          </CardHeader>
          <CardContent>
            {!sub ? (
              <p className="text-sm text-muted-foreground">{b.noSubscription}</p>
            ) : (
              <dl className="grid gap-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{b.status}</dt>
                  <dd>
                    <Badge variant={sub.status === "EXPIRED" ? "destructive" : sub.status === "GRACE" ? "warning" : "success"}>{b.statuses[sub.status]}</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{b.basis}</dt>
                  <dd>{b.bases[sub.billingBasis]}</dd>
                </div>
                {sub.status === "TRIALING" && sub.trialEndsAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{b.trialEnds}</dt>
                    <dd>{formatDate(sub.trialEndsAt, locale)}</dd>
                  </div>
                )}
                {sub.currentPeriodStart && sub.currentPeriodEnd && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{b.period}</dt>
                    <dd>
                      {formatDate(sub.currentPeriodStart, locale, { dateStyle: "medium" })} – {formatDate(sub.currentPeriodEnd, locale, { dateStyle: "medium" })}
                    </dd>
                  </div>
                )}
                {sub.graceEndsAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{b.graceEnds}</dt>
                    <dd>{formatDate(sub.graceEndsAt, locale)}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{b.next}</CardTitle>
            <CardDescription>{b.nextNote}</CardDescription>
          </CardHeader>
          <CardContent>
            {sub?.status === "EXEMPT" ? (
              <p className="text-sm text-muted-foreground">{b.exempt}</p>
            ) : data.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{b.noBillable}</p>
            ) : (
              <>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatDzd(String(data.estimate.total), locale)} <span className="text-sm font-normal text-muted-foreground">{b.perMonth}</span>
                </p>
                <p className="mt-4 text-sm font-medium">{b.billable}</p>
                <ul className="mt-2 divide-y divide-border text-sm">
                  {data.categories.map((c) => (
                    <li key={c.categoryId} className="flex justify-between gap-4 py-2">
                      <span>{name(c.slug)}</span>
                      {sub?.billingBasis !== "NEGOTIATED" && <span className="tabular-nums text-muted-foreground">{formatDzd(String(c.monthlyPrice), locale)}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold">{b.invoicesTitle}</h2>
        <Link href={`/${locale}/dashboard/provider/invoices`} className="text-sm text-muted-foreground hover:text-foreground">
          {b.invoicesTitle} ›
        </Link>
      </div>
      <div className="mt-3">
        <InvoiceList invoices={data.invoices} locale={locale} b={b} limit={3} />
      </div>
    </div>
  );
}
