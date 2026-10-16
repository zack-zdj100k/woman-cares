import { Suspense } from "react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { UnverifiedBanner } from "@/components/dashboard/unverified-banner";
import { FindCareButton } from "@/components/marketing/find-care-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.account.space, robots: { index: false } };
}

export default async function ClientDashboardPage() {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <ClientDashboard locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function ClientDashboard({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "client", `/${locale}/dashboard/client`);
  const t = await getAuthDictionary(locale);
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      {!user.emailVerified && <UnverifiedBanner locale={locale} t={t} />}
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{t.dashboard.client.title(user.fullName.split(" ")[0])}</h1>
      <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-ink-2">{t.dashboard.client.intro}</p>
      <FindCareButton label={t.dashboard.client.explore} variant="solid" className="mt-8" />
    </div>
  );
}
