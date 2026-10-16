import { Suspense } from "react";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { NotificationsView } from "@/components/dashboard/notifications-view";

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.notifications.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/notifications">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <View params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function View({ params, searchParams }: PageProps<"/[locale]/dashboard/provider/notifications">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/notifications`);
  const page = Math.max(1, Math.min(500, Number((await searchParams).page) || 1));
  return <NotificationsView user={user} locale={locale} area="provider" page={page} />;
}
