import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { NotificationsView } from "@/components/dashboard/notifications-view";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.notifications.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/notifications">) {
  return (
    <View params={params} searchParams={searchParams} />
  );
}

async function View({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/notifications">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/notifications`);
  const page = Math.max(1, Math.min(500, Number((await searchParams).page) || 1));
  return <NotificationsView user={user} locale={locale} area="admin" page={page} />;
}
