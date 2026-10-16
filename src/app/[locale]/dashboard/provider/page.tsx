import { Suspense } from "react";
import type { Metadata } from "next";
import type { CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { db } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { UnverifiedBanner } from "@/components/dashboard/unverified-banner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.account.space, robots: { index: false } };
}

export default async function ProviderDashboardPage() {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <ProviderDashboard locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function ProviderDashboard({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider`);
  const [t, dict] = await Promise.all([getAuthDictionary(locale), getDictionary(locale)]);
  // Ownership comes from the session, never from the URL.
  const account = await db.providerAccount.findUnique({
    where: { userId: user.id },
    select: {
      businessName: true,
      status: true,
      profiles: { select: { slug: true, status: true, category: { select: { slug: true, sortOrder: true } } }, orderBy: { category: { sortOrder: "asc" } } },
      categoryRequests: { where: { status: "PENDING" }, select: { id: true, category: { select: { slug: true } } } },
    },
  });
  const p = t.dashboard.provider;
  const name = (slug: string) => dict.categories[slug as CategorySlug]?.name ?? slug;

  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      {!user.emailVerified && <UnverifiedBanner locale={locale} t={t} />}
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{p.title(user.fullName.split(" ")[0])}</h1>
      <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-ink-2">{p.intro}</p>

      {account && (
        <div className="mt-12 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section className="rounded-(--radius-media) border border-line p-6">
            <h2 className="text-sm text-ink-2">{p.status}</h2>
            <p className="type-display mt-2 text-3xl">{account.businessName}</p>
            <p className="mt-2 font-medium">{p.statuses[account.status]}</p>
          </section>
          <section className="rounded-(--radius-media) border border-line p-6">
            <h2 className="type-display text-3xl">{p.profiles}</h2>
            {account.profiles.length === 0 ? (
              <p className="mt-3 text-ink-2">{p.noProfiles}</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {account.profiles.map((pr) => (
                  <li key={pr.slug} className="flex items-center justify-between gap-4 py-3">
                    <span>{name(pr.category.slug)}</span>
                    <span className="rounded-full bg-surface px-3 py-1 text-sm">{p.profileStatuses[pr.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {account.categoryRequests.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-medium">{p.requests}</h3>
                <p className="mt-1 text-ink-2">{account.categoryRequests.map((r) => name(r.category.slug)).join(", ")}</p>
              </>
            )}
            <p className="mt-6 text-sm text-ink-2">{p.editorSoon}</p>
          </section>
        </div>
      )}
    </div>
  );
}
