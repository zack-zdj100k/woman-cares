import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { AccountSettings } from "@/components/dashboard/account/account-settings";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.account.title, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/admin/account">) {
  return <Account params={params} />;
}

async function Account({ params }: { params: PageProps<"/[locale]/dashboard/admin/account">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/account`);
  return <AccountSettings user={user} locale={locale} />;
}
