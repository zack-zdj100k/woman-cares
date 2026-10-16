import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import {
  getAdminDictionary,
  getAuthDictionary,
  getDictionary,
  getProviderDictionary,
} from "@/i18n/get-dictionary";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { canReview } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { getProviderReview } from "@/server/services/review";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AdminNav } from "@/components/admin/admin-nav";
import { DecisionForm } from "@/components/admin/decision-form";
import { DecisionFeedback } from "@/components/admin/decision-feedback";

type Params =
  PageProps<"/[locale]/dashboard/admin/providers/[providerId]">["params"];

export const metadata: Metadata = { robots: { index: false } };

export default function ProviderReviewPage({ params }: { params: Params }) {
  return (
    <PageShell>
      <Suspense fallback={<DashboardSkeleton />}>
        <Review params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Review({ params }: { params: Params }) {
  const { locale: l, providerId } = await params;
  if (!isLocale(l)) notFound();
  const locale: Locale = l;
  const user = await requireArea(
    locale,
    "admin",
    `/${locale}/dashboard/admin/providers/${providerId}`,
  );
  let data: Awaited<ReturnType<typeof getProviderReview>>;
  try {
    data = await getProviderReview(user, providerId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const [at, t, dict, pt] = await Promise.all([
    getAdminDictionary(locale),
    getAuthDictionary(locale),
    getDictionary(locale),
    getProviderDictionary(locale),
  ]);
  const { account, profiles, audit } = data;
  const decide = canReview(user);
  const labels = {
    note: at.actions.note,
    notePlaceholder: at.actions.notePlaceholder,
    done: at.actions.done,
    errors: at.actions.errors,
  };
  const cat = (slug: string) =>
    dict.categories[slug as CategorySlug]?.name ?? slug;
  const s = account.status;

  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      <AdminNav locale={locale} active="providers" copy={at.nav} />
      <Link
        href={`/${locale}/dashboard/admin/providers`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-rose-ink"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        {at.detail.back}
      </Link>
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">
        {account.businessName}
      </h1>
      <p className="mt-2 text-ink-2">
        {t.dashboard.provider.statuses[s]}
        {account.verifiedAt && ` · ${at.queue.verified}`}
      </p>
      {!decide && (
        <p className="mt-4 rounded-(--radius-field) bg-surface p-4 text-sm">
          {at.actions.readOnly}
        </p>
      )}
      <DecisionFeedback>
        <Block title={at.detail.account}>
          <dl className="grid gap-3 text-[0.95rem] sm:grid-cols-2">
            <div>
              <dt className="text-ink-2">{at.detail.contact}</dt>
              <dd>
                {account.user.fullName} · <bdi dir="ltr">{account.user.email}</bdi> ·{" "}
                <bdi dir="ltr">{account.user.phone ?? "-"}</bdi>
              </dd>
              <dd className="text-sm">
                {account.user.emailVerifiedAt
                  ? at.detail.emailVerified
                  : at.detail.emailNotVerified}
              </dd>
            </div>
            <div>
              <dt className="text-ink-2">{at.detail.location}</dt>
              <dd>
                {[
                  account.commune?.nameFr,
                  locale === "ar"
                    ? account.wilaya.nameAr
                    : account.wilaya.nameFr,
                ]
                  .filter(Boolean)
                  .join(", ")}{" "}
                · {pt.settings.visibilityOptions[account.locationVisibility]}
              </dd>
            </div>
            <div>
              <dt className="text-ink-2">{at.detail.privateAddress}</dt>
              <dd>{account.addressLine ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-ink-2">{at.detail.joined}</dt>
              <dd>{formatDate(account.user.createdAt, locale)}</dd>
            </div>
          </dl>
          {account.reviewNote && (
            <p className="mt-4 text-sm text-rose-ink">{account.reviewNote}</p>
          )}
          {decide && (
            <div className="mt-6 flex flex-wrap items-start gap-3">
              {(s === "ONBOARDING" || s === "PENDING_REVIEW") && (
                <DecisionForm
                  op="account.approve"
                  id={account.id}
                  label={at.actions.approveAccount}
                  labels={labels}
                  tone="solid"
                />
              )}
              {(s === "ONBOARDING" || s === "PENDING_REVIEW") && (
                <DecisionForm
                  op="account.reject"
                  id={account.id}
                  label={at.actions.rejectAccount}
                  labels={labels}
                  tone="danger"
                  withNote
                />
              )}
              {s !== "SUSPENDED" && s !== "REJECTED" && (
                <DecisionForm
                  op="account.suspend"
                  id={account.id}
                  label={at.actions.suspendAccount}
                  labels={labels}
                  tone="danger"
                  withNote
                />
              )}
              {(s === "SUSPENDED" || s === "REJECTED") && (
                <DecisionForm
                  op="account.reinstate"
                  id={account.id}
                  label={at.actions.reinstateAccount}
                  labels={labels}
                />
              )}
              {s === "APPROVED" && (
                <DecisionForm
                  op={
                    account.verifiedAt ? "account.unverify" : "account.verify"
                  }
                  id={account.id}
                  label={
                    account.verifiedAt ? at.actions.unverify : at.actions.verify
                  }
                  labels={labels}
                />
              )}
            </div>
          )}
        </Block>

        <Block title={at.detail.profiles}>
          {profiles.length === 0 && (
            <p className="text-ink-2">{at.detail.noProfiles}</p>
          )}
          <div className="grid gap-8">
            {profiles.map((p) => (
              <article
                key={p.id}
                className="rounded-(--radius-media) border border-line p-6"
              >
                <p className="flex flex-wrap items-center gap-3">
                  <span className="type-display text-3xl">
                    {cat(p.category.slug)}
                  </span>
                  <span className="rounded-full bg-surface px-3 py-1 text-sm">
                    {t.dashboard.provider.profileStatuses[p.status]}
                  </span>
                </p>
                <p className="mt-2 font-medium">{p.headline}</p>
                {p.description && (
                  <p className="mt-2 whitespace-pre-line text-ink-2">
                    {p.description}
                  </p>
                )}
                {(p.hygieneNotes || p.productNotes) && (
                  <p className="mt-2 text-sm text-ink-2">
                    {at.detail.declared} :{" "}
                    {[p.hygieneNotes, p.productNotes]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                <p className="mt-4 text-sm font-medium">{at.detail.services}</p>
                {p.services.length === 0 ? (
                  <p className="text-sm text-ink-2">{at.detail.noServices}</p>
                ) : (
                  <ul className="text-sm">
                    {p.services.map((sv) => (
                      <li key={sv.id}>
                        {sv.name} · {sv.durationMinutes} min ·{" "}
                        {formatDzd(sv.priceMin.toString(), locale)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm">
                  {at.detail.hours(p._count.schedules)}
                </p>
                {p.mediaUrls.length > 0 && (
                  <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {p.mediaUrls.map((m) => (
                      <li
                        key={m.id}
                        className="relative aspect-square overflow-hidden rounded-lg bg-surface-2"
                      >
                        {m.type === "IMAGE" ? (
                          <Image
                            src={m.url}
                            alt=""
                            fill
                            sizes="120px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-xs">
                            {at.detail.video}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {p.reviewNote && (
                  <p className="mt-3 text-sm text-rose-ink">{p.reviewNote}</p>
                )}
                {decide && (
                  <div className="mt-5 flex flex-wrap items-start gap-3">
                    {p.status === "PENDING_REVIEW" && (
                      <DecisionForm
                        op="profile.approve"
                        id={p.id}
                        label={at.actions.approveProfile}
                        labels={labels}
                        tone="solid"
                      />
                    )}
                    {p.status === "PENDING_REVIEW" && (
                      <DecisionForm
                        op="profile.changes"
                        id={p.id}
                        label={at.actions.requestChanges}
                        labels={labels}
                        withNote
                      />
                    )}
                    {p.status !== "SUSPENDED" && p.status !== "ARCHIVED" && (
                      <DecisionForm
                        op="profile.suspend"
                        id={p.id}
                        label={at.actions.suspendProfile}
                        labels={labels}
                        tone="danger"
                        withNote
                      />
                    )}
                    {p.status === "SUSPENDED" && (
                      <DecisionForm
                        op="profile.reinstate"
                        id={p.id}
                        label={at.actions.reinstateProfile}
                        labels={labels}
                      />
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </Block>

        <Block title={at.detail.requests}>
          {account.categoryRequests.length === 0 ? (
            <p className="text-ink-2">{at.detail.noRequests}</p>
          ) : (
            <ul className="grid gap-4">
              {account.categoryRequests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-(--radius-field) border border-line p-4"
                >
                  <p className="font-medium">
                    {cat(r.category.slug)} · {at.detail.requestStatuses[r.status]}
                  </p>
                  {r.decisionNote && (
                    <p className="text-sm text-ink-2">{r.decisionNote}</p>
                  )}
                  {decide && r.status === "PENDING" && (
                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      <DecisionForm
                        op="request.approve"
                        id={r.id}
                        label={at.actions.approveRequest}
                        labels={labels}
                        tone="solid"
                      />
                      <DecisionForm
                        op="request.reject"
                        id={r.id}
                        label={at.actions.rejectRequest}
                        labels={labels}
                        tone="danger"
                        withNote
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={at.detail.credentials}>
          {account.credentials.length === 0 ? (
            <p className="text-ink-2">{at.detail.noCredentials}</p>
          ) : (
            <ul className="grid gap-4">
              {account.credentials.map((c) => (
                <li
                  key={c.id}
                  className="rounded-(--radius-field) border border-line p-4"
                >
                  <p className="font-medium">
                    {pt.credentials.types[c.type] ?? c.type} ·{" "}
                    {cat(c.category?.slug ?? "")} ·{" "}
                    {pt.credentials.statuses[c.status]}
                  </p>
                  <p className="text-sm text-ink-2">
                    {c.issuer ?? ""}
                    {c.expiresAt &&
                      ` · ${at.detail.expires} ${formatDate(c.expiresAt, locale, { dateStyle: "long", timeZone: "UTC" })}`}
                  </p>
                  {decide && (
                    <a
                      href={`/api/v1/admin/credentials/${c.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm underline underline-offset-4"
                    >
                      {at.detail.openFile}
                    </a>
                  )}
                  {decide && c.status === "PENDING" && (
                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      <DecisionForm
                        op="credential.approve"
                        id={c.id}
                        label={at.actions.approveCredential}
                        labels={labels}
                        tone="solid"
                      />
                      <DecisionForm
                        op="credential.reject"
                        id={c.id}
                        label={at.actions.rejectCredential}
                        labels={labels}
                        tone="danger"
                        withNote
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={at.detail.history}>
          {audit.length === 0 ? (
            <p className="text-ink-2">{at.detail.noHistory}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {audit.map((a) => (
                <li key={a.id}>
                  {formatDate(a.createdAt, locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {at.audit[a.action] ?? a.action} · {at.detail.by}{" "}
                  {a.actor
                    ? `${a.actor.fullName} (${a.actor.role})`
                    : at.detail.system}
                </li>
              ))}
            </ul>
          )}
        </Block>
      </DecisionFeedback>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-10 last:border-b-0">
      <h2 className="type-display mb-6 text-[clamp(1.9rem,3vw,2.5rem)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
