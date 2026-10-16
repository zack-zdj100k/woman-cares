import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getDictionary, getProviderDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { listMyProfiles } from "@/server/services/provider-profiles";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ProviderNav } from "@/components/provider/provider-nav";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const pt = await getProviderDictionary(await getLocale());
  return { title: pt.index.scheduleTitle, robots: { index: false } };
}

/** Each category profile has its own schedule; this page points to the right editor section. */
export default async function Page() {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <Index locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function Index({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/schedule`);
  const [dict, pt, profiles] = await Promise.all([getDictionary(locale), getProviderDictionary(locale), listMyProfiles(user)]);
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      <ProviderNav locale={locale} active="profiles" copy={pt.nav} />
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{pt.index.scheduleTitle}</h1>
      <p className="mt-4 max-w-[44rem] text-lg text-ink-2">{pt.index.scheduleIntro}</p>
      <ul className="mt-10 grid gap-3">
        {profiles
          .filter((p) => p.status !== "ARCHIVED")
          .map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 rounded-(--radius-field) border border-line p-5">
              <span className="type-display text-2xl">{dict.categories[p.category.slug as CategorySlug]?.name}</span>
              <Link href={`/${locale}/dashboard/provider/profiles/${p.id}#hours`} className={buttonClass({ variant: "outline", size: "sm" })}>
                {pt.index.open}
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
