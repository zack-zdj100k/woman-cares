import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import {
  getAdminDictionary,
  getAuthDictionary,
  getDictionary,
  getDashboardDictionary,
  getProviderDictionary,
} from "@/i18n/get-dictionary";
import { getProviderBilling, previewDirectPayment } from "@/server/services/billing";
import { DirectPaymentForm, RecordPaymentForm, TermsForm, TrialForm } from "@/components/dashboard/billing-forms";
import { ReceiptForm } from "@/components/dashboard/receipt-form";
import { algiersDate } from "@/lib/periods";
import { Badge } from "@/components/ui/badge";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { canDelete, canReview, canVerifyPayment } from "@/server/policies/roles";
import { ManageForm } from "@/components/admin/manage-form";
import { ForbiddenError } from "@/server/services/admin-users";
import { getProviderReview } from "@/server/services/review";
import { DecisionForm } from "@/components/admin/decision-form";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { pageClass } from "@/components/dashboard/shell/dashboard-shell";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

type Params =
  PageProps<"/[locale]/dashboard/admin/providers/[providerId]">["params"];

export const metadata: Metadata = { robots: { index: false } };

export default function ProviderReviewPage({ params }: { params: Params }) {
  return (
    <>
      <Review params={params} />
    </>
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
  const [at, t, dict, pt, dd, billing] = await Promise.all([
    getAdminDictionary(locale),
    getAuthDictionary(locale),
    getDictionary(locale),
    getProviderDictionary(locale),
    getDashboardDictionary(locale),
    getProviderBilling(user, providerId),
  ]);
  const b = dd.billing;
  const sub = billing.subscription;
  const { account, profiles, audit } = data;
  const decide = canReview(user);
  const canPay = canVerifyPayment(user);
  const hasUnpaid = billing.invoices.some((inv) => inv.status === "OPEN" || inv.status === "OVERDUE");
  const direct = canPay && sub && !hasUnpaid ? await previewDirectPayment(user, providerId) : null;
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
    <div className={pageClass}>
      <BackLink
        href={`/${locale}/dashboard/admin/providers`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-rose-ink"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        {at.detail.back}
      </BackLink>
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
          {!account.user.emailVerifiedAt && decide && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 px-4 py-3 text-sm">
              <span className="text-warning">{at.detail.emailPending}</span>
              <ManageForm op="user.confirmEmail" id={account.user.id} label={at.detail.confirmEmail} labels={{ done: at.manage.done, errors: at.manage.errors }} confirm={at.detail.confirmEmailHelp} />
            </div>
          )}
          {account.user.status === "SUSPENDED" && (
            <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {at.detail.userSuspended}{" "}
              <Link href={`/${locale}/dashboard/admin/users/${account.user.id}`} className="underline underline-offset-4">
                {at.detail.openUser}
              </Link>
            </p>
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
          {canDelete(user) && (
            <div className="mt-6 border-t border-border pt-5">
              <ManageForm
                op="provider.delete"
                id={account.id}
                label={at.deletes.provider}
                labels={{ done: at.manage.done, errors: at.manage.errors }}
                tone="danger"
                confirm={at.deletes.userConfirm}
                fields={<input type="hidden" name="next" value={`/${locale}/dashboard/admin/providers`} />}
              />
            </div>
          )}
        </Block>

        <span id="abonnement" className="block scroll-mt-24" aria-hidden="true" />
        {/* Subscription: how this professional is billed (Admin can set an agreed price). */}
        <Block title={b.termsTitle}>
          {!sub ? (
            <p className="text-sm text-muted-foreground">{b.noSubscription}</p>
          ) : (
            <div className="grid gap-6">
              <dl className="grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">{b.status}</dt>
                  <dd className="mt-1">
                    <Badge variant={sub.status === "EXPIRED" ? "destructive" : sub.status === "GRACE" ? "warning" : sub.status === "EXEMPT" ? "outline" : "success"}>{b.statuses[sub.status]}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{b.current}</dt>
                  <dd className="mt-1">
                    {b.bases[sub.billingBasis]}
                    {sub.billingBasis === "NEGOTIATED" && sub.negotiatedMonthlyPrice && ` · ${formatDzd(sub.negotiatedMonthlyPrice.toString(), locale)} ${b.perMonth}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{sub.status === "TRIALING" ? b.trialEnds : b.period}</dt>
                  <dd className="mt-1">
                    {sub.status === "TRIALING" && sub.trialEndsAt
                      ? formatDate(sub.trialEndsAt, locale)
                      : sub.currentPeriodStart && sub.currentPeriodEnd
                        ? `${formatDate(sub.currentPeriodStart, locale, { dateStyle: "medium" })} – ${formatDate(sub.currentPeriodEnd, locale, { dateStyle: "medium" })}`
                        : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{b.billable}</dt>
                  <dd className="mt-1">{billing.categories.length ? billing.categories.map((c) => cat(c.slug)).join(", ") : "-"}</dd>
                </div>
              </dl>
              {sub.exemptReason && <p className="text-sm text-muted-foreground">{sub.exemptReason}</p>}
              {decide && (
                <div className="grid gap-3 rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">{b.trialTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {sub.trialEndsAt ? b.trialCurrent(formatDate(sub.trialEndsAt, locale), sub.trialEndsAt > new Date()) : b.trialNoneYet}
                  </p>
                  <TrialForm
                    providerId={account.id}
                    endsOn={sub.trialEndsAt ? algiersDate(new Date(sub.trialEndsAt.getTime() - 1)) : algiersDate(new Date())}
                    current={sub.trialEndsAt?.toISOString() ?? null}
                    labels={{ endsOn: b.trialEndsOn, save: b.trialSave, plus: [1, 2, 3, 6].map((months) => ({ months, label: b.trialPlus(months) })), none: b.trialNone, noneHint: b.trialNoneHint, done: b.trialDone, errors: b.errors }}
                  />
                </div>
              )}
              {decide && (
                <TermsForm
                  providerId={account.id}
                  current={sub.billingBasis === "NEGOTIATED" || sub.billingBasis === "EXEMPT" ? sub.billingBasis : "PER_CATEGORY"}
                  negotiated={sub.negotiatedMonthlyPrice?.toString() ?? null}
                  reason={sub.exemptReason}
                  labels={{
                    standard: b.standard,
                    standardHelp: b.standardHelp(formatDzd(String(billing.standardMonthly), locale)),
                    negotiated: b.negotiated,
                    negotiatedHelp: b.negotiatedHelp,
                    exemption: b.exemption,
                    exemptionHelp: b.exemptionHelp,
                    monthly: b.monthly,
                    reason: b.reason,
                    save: b.saveTerms,
                    saved: b.saved,
                    errors: b.errors,
                  }}
                />
              )}
              {canDelete(user) && (
                <ManageForm op="subscription.delete" id={sub.id} label={at.deletes.subscription} labels={{ done: at.manage.done, errors: at.manage.errors }} tone="danger" confirm={at.deletes.subscriptionConfirm} />
              )}
              {direct && (
                <DirectPaymentForm
                  providerId={account.id}
                  amount={sub.billingBasis === "NEGOTIATED" && sub.negotiatedMonthlyPrice ? Math.round(Number(sub.negotiatedMonthlyPrice)) : billing.standardMonthly || null}
                  today={algiersDate(new Date())}
                  labels={{
                    title: b.direct.title,
                    help: b.direct.help(formatDate(direct.start, locale, { dateStyle: "medium" }), formatDate(new Date(direct.end.getTime() - 1), locale, { dateStyle: "medium" })),
                    amount: b.direct.amount,
                    method: b.method,
                    reference: b.reference,
                    paidOn: b.paidOn,
                    save: b.direct.save,
                    done: b.direct.done,
                    methods: b.methods,
                    errors: b.errors,
                  }}
                />
              )}
              {canPay && hasUnpaid && <p className="text-xs text-muted-foreground">{b.direct.useInvoice}</p>}
              <div>
                <p className="mb-2 text-sm font-medium">{b.invoicesTitle}</p>
                {billing.invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{b.noInvoices}</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {billing.invoices.map((inv) => (
                      <li key={inv.id} className="grid gap-3 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-medium" dir="ltr">
                            {inv.number}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(inv.periodStart, locale, { dateStyle: "medium" })} – {formatDate(inv.periodEnd, locale, { dateStyle: "medium" })}
                          </span>
                          <span className="tabular-nums">{formatDzd(inv.total.toString(), locale)}</span>
                          <Badge variant={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : "warning"}>{b.invoiceStatuses[inv.status]}</Badge>
                        </div>
                        {canPay &&
                          inv.payments
                            .filter((pay) => pay.status === "PAID")
                            .map((pay) => (
                              <ReceiptForm
                                key={pay.id}
                                paymentId={pay.id}
                                note={pay.receiptNote ?? ""}
                                from={algiersDate(pay.coveredFrom ?? inv.periodStart)}
                                to={algiersDate(new Date((pay.coveredTo ?? inv.periodEnd).getTime() - (pay.coveredTo ? 0 : 1)))}
                                labels={{ title: pay.receiptKey || pay.receiptNote ? `${b.receiptTitle} ✓` : b.receiptTitle, hint: b.receiptHint, file: b.receiptFile, note: b.receiptNote, from: b.receiptFrom, to: b.receiptTo, save: b.receiptSave, saved: b.receiptSaved, errors: b.receiptErrors }}
                              />
                            ))}
                        {canDelete(user) && (
                          <ManageForm op="invoice.delete" id={inv.id} label={at.deletes.invoice} labels={{ done: at.manage.done, errors: at.manage.errors }} tone="danger" confirm={at.deletes.invoiceConfirm} />
                        )}
                        {canPay && (inv.status === "OPEN" || inv.status === "OVERDUE") && (
                          <RecordPaymentForm invoiceId={inv.id} today={algiersDate(new Date())} labels={{ method: b.method, reference: b.reference, paidOn: b.paidOn, save: b.record, methods: b.methods, errors: b.errors }} />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Block>

        <Block title={at.detail.profiles}>
          {profiles.length === 0 && (
            <p className="text-ink-2">{at.detail.noProfiles}</p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
            {profiles.map((p) => (
              <article
                key={p.id}
                className="min-w-0 rounded-(--radius-media) border border-line p-6 [overflow-wrap:anywhere]"
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
