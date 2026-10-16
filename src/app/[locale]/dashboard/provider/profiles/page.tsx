import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, getDictionary, getProviderDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { db } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { listMyProfiles } from "@/server/services/provider-profiles";
import { archiveProfileAction } from "../actions";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ProviderNav } from "@/components/provider/provider-nav";
import { AddCategoryForm } from "@/components/provider/add-category-form";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const pt = await getProviderDictionary(await getLocale());
  return { title: pt.profiles.title, robots: { index: false } };
}

export default async function ProfilesPage() {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <Profiles locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function Profiles({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/profiles`);
  const [dict, t, pt, profiles] = await Promise.all([getDictionary(locale), getAuthDictionary(locale), getProviderDictionary(locale), listMyProfiles(user)]);
  const requests = await db.providerCategoryRequest.findMany({
    where: { provider: { userId: user.id }, status: "PENDING" },
    select: { id: true, category: { select: { slug: true } } },
  });
  const name = (slug: string) => dict.categories[slug as CategorySlug]?.name ?? slug;
  const active = profiles.filter((p) => p.status !== "ARCHIVED");
  const archived = profiles.filter((p) => p.status === "ARCHIVED");
  const taken = new Set([...active.map((p) => p.category.slug), ...requests.map((r) => r.category.slug)]);
  const addable = categorySlugs.filter((s) => !taken.has(s)).map((s) => ({ slug: s, label: name(s) }));

  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      <ProviderNav locale={locale} active="profiles" copy={pt.nav} />
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{pt.profiles.title}</h1>
      <p className="mt-4 max-w-[44rem] text-lg leading-relaxed text-ink-2">{pt.profiles.intro}</p>

      <ul className="mt-10 grid gap-4">
        {active.map((p) => (
          <li key={p.id} className="flex flex-col gap-4 rounded-(--radius-media) border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-3">
                <span className="type-display text-3xl">{name(p.category.slug)}</span>
                <span className="rounded-full bg-surface px-3 py-1 text-sm">{t.dashboard.provider.profileStatuses[p.status]}</span>
              </p>
              <p className="mt-2 text-sm text-ink-2">{pt.profiles.counts(p._count.services, p._count.media, p._count.schedules > 0)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/${locale}/dashboard/provider/profiles/${p.id}`} className={buttonClass({ variant: "solid", size: "sm" })}>
                {pt.profiles.edit}
              </Link>
              {p.status !== "SUSPENDED" && p.status !== "RESTRICTED" && (
                <details className="relative">
                  <summary className="cursor-pointer list-none text-sm text-ink-2 underline underline-offset-4 [&::-webkit-details-marker]:hidden">{pt.profiles.archive}</summary>
                  <div className="absolute end-0 z-10 mt-2 w-72 rounded-(--radius-field) border border-line bg-ground p-4 shadow-[0_20px_50px_-25px_rgb(37_22_29/0.45)]">
                    <p className="text-sm leading-relaxed">{pt.profiles.archiveNote}</p>
                    <form action={archiveProfileAction} className="mt-3">
                      <input type="hidden" name="profileId" value={p.id} />
                      <button type="submit" className={buttonClass({ variant: "outline", size: "sm" })}>
                        {pt.profiles.archiveConfirm}
                      </button>
                    </form>
                  </div>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>

      {requests.length > 0 && (
        <p className="mt-6 text-ink-2">
          {pt.profiles.pendingRequests} : {requests.map((r) => name(r.category.slug)).join(", ")}
        </p>
      )}

      <section className="mt-14 rounded-(--radius-media) bg-surface p-6 md:p-8">
        <h2 className="type-display text-3xl">{pt.profiles.addTitle}</h2>
        <p className="mt-2 mb-5 text-ink-2">{pt.profiles.addIntro}</p>
        <AddCategoryForm options={addable} labels={{ choose: pt.profiles.chooseCategory, submit: pt.profiles.addSubmit }} notes={pt.profiles.notes} errors={pt.common.errors} />
        {archived.length > 0 && (
          <p className="mt-5 text-sm text-ink-2">
            {pt.profiles.archived} : {archived.map((p) => name(p.category.slug)).join(", ")}. {pt.profiles.restore}
          </p>
        )}
      </section>
    </div>
  );
}
