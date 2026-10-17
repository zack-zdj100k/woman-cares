import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { getMyBilling } from "@/server/services/billing";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { InvoiceList } from "@/components/dashboard/invoice-list";

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.billing.invoicesTitle, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/provider/invoices">) {
  return (
    <Invoices params={params} />
  );
}

async function Invoices({ params }: { params: PageProps<"/[locale]/dashboard/provider/invoices">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/invoices`);
  const [d, data] = await Promise.all([getDashboardDictionary(locale), getMyBilling(user)]);
  return (
    <div className={pageClass}>
      <PageHeader title={d.billing.invoicesTitle} description={d.billing.invoicesDescription} />
      <InvoiceList invoices={data.invoices} locale={locale} b={d.billing} />
    </div>
  );
}
