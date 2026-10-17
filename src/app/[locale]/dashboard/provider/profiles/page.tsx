import type { Metadata } from "next";
import Link from "next/link";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, getDictionary, getProviderDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { db } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { listMyProfiles } from "@/server/services/provider-profiles";
import { listMyCredentials } from "@/server/services/credentials";
import { CredentialUpload } from "@/components/provider/credential-upload";
import { formatDate } from "@/lib/format";
import { archiveProfileAction } from "../actions";
import { AddCategoryForm } from "@/components/provider/add-category-form";
import { buttonClass } from "@/components/ui/button";
import { pageClass } from "@/components/dashboard/shell/dashboard-shell";

export async function generateMetadata(): Promise<Metadata> {
  const pt = await getProviderDictionary(await getLocale());
  return { title: pt.profiles.title, robots: { index: false } };
}

export default async function ProfilesPage() {
  const locale = await getLocale();
  return (
    <>
      <Profiles locale={locale} />
    </>
  );
}

async function Profiles({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/profiles`);
  const [dict, t, pt, profiles] = await Promise.all([getDictionary(locale), getAuthDictionary(locale), getProviderDictionary(locale), listMyProfiles(user)]);
  const [requests, rejectedRequests, credentials, account] = await Promise.all([
    db.providerCategoryRequest.findMany({
      where: { provider: { userId: user.id }, status: "PENDING" },
      select: { id: true, category: { select: { slug: true, requiresCredentialReview: true } } },
    }),
    db.providerCategoryRequest.findMany({
      where: { provider: { userId: user.id }, status: "REJECTED" },
      orderBy: { decidedAt: "desc" },
      take: 3,
      select: { id: true, decisionNote: true, category: { select: { slug: true } } },
    }),
    listMyCredentials(user),
    db.providerAccount.findUnique({ where: { userId: user.id }, select: { status: true, reviewNote: true } }),
  ]);
  const name = (slug: string) => dict.categories[slug as CategorySlug]?.name ?? slug;
  const active = profiles.filter((p) => p.status !== "ARCHIVED");
  const archived = profiles.filter((p) => p.status === "ARCHIVED");
  const taken = new Set([...active.map((p) => p.category.slug), ...requests.map((r) => r.category.slug)]);
  const addable = categorySlugs.filter((s) => !taken.has(s)).map((s) => ({ slug: s, label: name(s) }));

  return (
    <div className={pageClass}>
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{pt.profiles.title}</h1>
      <p className="mt-4 max-w-[44rem] text-lg leading-relaxed text-ink-2">{pt.profiles.intro}</p>

      {account && (account.status === "REJECTED" || account.status === "SUSPENDED") && (
        <p role="status" className="mt-8 rounded-(--radius-field) bg-surface p-5 leading-relaxed">
          {account.status === "REJECTED" ? pt.review.accountRejected : pt.review.accountSuspended} {account.reviewNote}
        </p>
      )}

      <ul className="mt-10 grid gap-4">
        {active.map((p) => (
          <li key={p.id} className="flex flex-col gap-4 rounded-(--radius-media) border border-line p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-3">
                <span className="type-display text-3xl">{name(p.category.slug)}</span>
                <span className="rounded-full bg-surface px-3 py-1 text-sm">{t.dashboard.provider.profileStatuses[p.status]}</span>
              </p>
              <p className="mt-2 text-sm text-ink-2">{pt.profiles.counts(p._count.services, p._count.media, p._count.schedules > 0)}</p>
              {p.reviewNote && (p.status === "DRAFT" || p.status === "SUSPENDED") && (
                <p className="mt-2 text-sm text-rose-ink">
                  {p.status === "SUSPENDED" ? pt.review.suspended : pt.review.changesRequested} {p.reviewNote}
                </p>
              )}
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

      {rejectedRequests.length > 0 && (
        <ul className="mt-4 grid gap-1 text-sm text-ink-2">
          {rejectedRequests.map((r) => (
            <li key={r.id}>{pt.review.requestRejected(name(r.category.slug), r.decisionNote)}</li>
          ))}
        </ul>
      )}

      {(requests.some((r) => r.category.requiresCredentialReview) || credentials.length > 0) && (
        <section aria-labelledby="credentials-title" className="mt-14 rounded-(--radius-media) border border-line p-6 md:p-8">
          <h2 id="credentials-title" className="type-display text-3xl">
            {pt.credentials.title}
          </h2>
          <p className="mt-2 mb-6 max-w-[44rem] text-ink-2">{pt.credentials.intro}</p>
          {credentials.length === 0 ? (
            <p className="mb-6 text-sm text-ink-2">{pt.credentials.none}</p>
          ) : (
            <ul className="mb-8 divide-y divide-line border-y border-line">
              {credentials.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {pt.credentials.types[c.type] ?? c.type} · {name(c.category?.slug ?? "")}
                    {c.issuer && <span className="text-ink-2"> · {c.issuer}</span>}
                    <span className="block text-ink-2">{formatDate(c.createdAt, locale)}</span>
                    {c.status === "REJECTED" && c.notes && <span className="block text-rose-ink">{c.notes}</span>}
                  </span>
                  <span className="rounded-full bg-surface px-3 py-1">{pt.credentials.statuses[c.status]}</span>
                </li>
              ))}
            </ul>
          )}
          <CredentialUpload
            copy={pt.credentials}
            categories={[
              ...requests.filter((r) => r.category.requiresCredentialReview).map((r) => r.category.slug),
              ...active.filter((p) => p.category.slug === "botox").map((p) => p.category.slug),
            ]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((slug) => ({ slug, label: name(slug) }))}
          />
        </section>
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
