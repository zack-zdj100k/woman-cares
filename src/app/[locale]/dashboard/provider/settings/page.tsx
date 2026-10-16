import { Suspense } from "react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getPagesDictionary, getProviderDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { getBusinessSettings } from "@/server/services/provider-profiles";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ProviderNav } from "@/components/provider/provider-nav";
import { SettingsForm } from "@/components/provider/settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const pt = await getProviderDictionary(await getLocale());
  return { title: pt.settings.title, robots: { index: false } };
}

export default async function SettingsPage() {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <Settings locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function Settings({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/settings`);
  const [pt, pages, account] = await Promise.all([getProviderDictionary(locale), getPagesDictionary(locale), getBusinessSettings(user)]);
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      <ProviderNav locale={locale} active="settings" copy={pt.nav} />
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{pt.settings.title}</h1>
      <p className="mt-4 mb-10 max-w-[44rem] text-lg leading-relaxed text-ink-2">{pt.settings.intro}</p>
      <div className="max-w-[44rem]">
        <SettingsForm
          locale={locale}
          copy={pt.settings}
          common={pt.common}
          workplaceLabels={pages.workplace}
          disabled={account.status === "SUSPENDED" || account.status === "REJECTED"}
          initial={{
            businessName: account.businessName,
            bio: account.bio ?? "",
            publicPhone: account.publicPhone ?? "",
            wilaya: account.wilayaCode,
            commune: account.communeName,
            addressLine: account.addressLine ?? "",
            workplaceType: account.workplaceType,
            locationVisibility: account.locationVisibility,
            latitude: account.latitude ? Number(account.latitude) : null,
            longitude: account.longitude ? Number(account.longitude) : null,
          }}
        />
      </div>
    </div>
  );
}
