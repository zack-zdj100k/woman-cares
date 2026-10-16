import { Suspense } from "react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { getAdminDictionary, getAuthDictionary } from "@/i18n/get-dictionary";
import { queueCounts } from "@/server/services/review";
import { AdminNav } from "@/components/admin/admin-nav";
import { buttonClass } from "@/components/ui/button";
import { getLocale } from "@/i18n/server";
import { db } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.dashboard.admin.title, robots: { index: false } };
}

export default async function AdminDashboardPage() {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <AdminDashboard locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function AdminDashboard({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin`);
  const [t, at] = await Promise.all([getAuthDictionary(locale), getAdminDictionary(locale)]);
  const a = t.dashboard.admin;
  const q = await queueCounts(user);
  const [clients, providers, pending, requests, support] = await Promise.all([
    db.user.count({ where: { role: "CLIENT" } }),
    db.providerAccount.count(),
    db.providerAccount.count({ where: { status: { in: ["ONBOARDING", "PENDING_REVIEW"] } } }),
    db.providerCategoryRequest.count({ where: { status: "PENDING" } }),
    db.supportRequest.count({ where: { status: "OPEN" } }),
  ]);
  const stats = [
    { label: a.clients, value: clients },
    { label: a.providers, value: providers },
    { label: a.pendingProviders, value: pending },
    { label: a.categoryRequests, value: requests },
    { label: a.openSupport, value: support },
  ];
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      <AdminNav locale={locale} active="overview" copy={at.nav} />
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{a.title}</h1>
      <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-ink-2">{a.intro}</p>
      <p className="mt-2 text-sm text-ink-2">
        {a.role} : {user.role}
      </p>
      <section className="mt-10 flex flex-col gap-4 rounded-(--radius-media) bg-parchment p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="type-display text-3xl">{at.overview.queue}</h2>
          <p className="mt-1 text-ink-2">{q.providers === 0 ? at.overview.empty : at.overview.queueCounts(q.providers, q.profiles, q.requests, q.credentials)}</p>
        </div>
        <Link href={`/${locale}/dashboard/admin/providers`} className={buttonClass({ variant: "solid" })}>
          {at.overview.open}
        </Link>
      </section>
      <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-(--radius-media) border border-line p-6">
            <dt className="text-sm text-ink-2">{s.label}</dt>
            <dd className="type-display mt-2 text-5xl tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
