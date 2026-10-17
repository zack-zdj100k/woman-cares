import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { addDays, MAX_HORIZON_DAYS } from "@/lib/availability";
import { paymentSummary, providerActions } from "@/lib/booking-rules";
import { formatDate, formatDzd } from "@/lib/format";
import { getProviderBooking } from "@/server/services/booking-views";
import { today } from "@/server/services/bookings";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { BookingHistory, priceRange, StatusBadge, whenLong } from "@/components/dashboard/booking-ui";
import { bookingLabels } from "@/components/dashboard/booking-labels";
import { CloseVisitForm, ProposeTimeForm, ProviderCancelForm, RespondForm, VisitPaymentForm } from "@/components/dashboard/booking-forms";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.bookings.title, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/provider/bookings/[bookingId]">) {
  return (
    <Booking params={params} />
  );
}

async function Booking({ params }: { params: PageProps<"/[locale]/dashboard/provider/bookings/[bookingId]">["params"] }) {
  const { locale: l, bookingId } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/bookings/${bookingId}`);
  const [d, site, r] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), getProviderBooking(user, bookingId)]);
  const b = d.bookings;
  const backLink = (
    <Link href={`/${locale}/dashboard/provider/bookings`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden="true" />
      {b.back}
    </Link>
  );
  if (!r)
    return (
      <div className={pageClass}>
        {backLink}
        <p className="text-muted-foreground">{b.notFound}</p>
      </div>
    );
  const actions = providerActions(r, new Date());
  const L = bookingLabels(b);
  const category = site.categories[r.profile.category.slug as CategorySlug]?.name ?? r.profile.category.slug;
  const money = paymentSummary(r.payments.map((p) => ({ amount: Number(p.amount), status: p.status })));
  const first = today();

  return (
    <div className={pageClass}>
      {backLink}
      <PageHeader title={`${r.client.fullName} · ${r.serviceNameSnap}`} description={`${category} · ${b.minutes(r.durationMinSnap)}`} actions={<StatusBadge status={r.status} labels={b.providerStatuses} />} />
      <DecisionFeedback>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-6">
            <Card>
              <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{b.columns.when}</p>
                  <p className="mt-1 font-medium tabular-nums">{whenLong(r.startAt, locale)}</p>
                  {r.requestedStartAt.getTime() !== r.startAt.getTime() && (
                    <p className="text-muted-foreground">
                      {b.requested} : {whenLong(r.requestedStartAt, locale)}
                    </p>
                  )}
                  {r.proposedStartAt && (
                    <p className="text-chart-1">
                      {b.proposed} : {whenLong(r.proposedStartAt, locale)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{b.columns.price}</p>
                  <p className="mt-1 font-medium tabular-nums">{priceRange(r.priceMinSnap, r.priceMaxSnap, locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{b.phone}</p>
                  {r.client.phone ? (
                    <a href={`tel:${r.client.phone}`} className="mt-1 block font-medium underline underline-offset-4" dir="ltr">
                      {r.client.phone}
                    </a>
                  ) : (
                    <p className="mt-1 text-muted-foreground">{b.phoneHidden}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{b.reference}</p>
                  <p className="mt-1 font-medium" dir="ltr">
                    {r.reference}
                  </p>
                </div>
                {r.clientNote && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">{b.clientNote}</p>
                    <p className="mt-1 rounded-xl bg-white/4 px-4 py-3">{r.clientNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {actions.length > 0 && actions.some((a) => a !== "pay") && (
              <Card>
                <CardHeader>
                  <CardTitle>{b.actions}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6">
                  {actions.includes("respond") && <RespondForm bookingId={r.id} l={L} />}
                  {(actions.includes("complete") || actions.includes("noShow")) && <CloseVisitForm bookingId={r.id} l={L} />}
                  {actions.includes("propose") && (
                    <details className="group rounded-xl border border-border p-4">
                      <summary className="cursor-pointer text-sm font-medium">{b.propose}</summary>
                      <div className="mt-4">
                        <ProposeTimeForm bookingId={r.id} minDate={first} maxDate={addDays(first, MAX_HORIZON_DAYS)} locale={locale} l={L} />
                      </div>
                    </details>
                  )}
                  {actions.includes("cancel") && (
                    <div>
                      <ProviderCancelForm bookingId={r.id} l={L} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(actions.includes("pay") || r.payments.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>{b.payments}</CardTitle>
                  <CardDescription>{b.paymentsHint}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                  {r.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{b.paymentsEmpty}</p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {r.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <span>
                            {p.status === "REFUNDED" ? b.refund : b.paymentStatuses.PAID} · {b.methods[p.method ?? ""] ?? p.method}
                            {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                          </span>
                          <span className="text-end tabular-nums">
                            {p.status === "REFUNDED" ? "-" : ""}
                            {formatDzd(p.amount.toString(), locale)}
                            <span className="block text-xs text-muted-foreground">{formatDate(p.recordedAt, locale, { dateStyle: "medium" })}</span>
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-between py-2.5 font-medium">
                        <span>{b.net}</span>
                        <span className="tabular-nums">{formatDzd(String(money.net), locale)}</span>
                      </li>
                    </ul>
                  )}
                  {actions.includes("pay") && <VisitPaymentForm bookingId={r.id} l={L} />}
                </CardContent>
              </Card>
            )}

            {r.review && (
              <Card>
                <CardHeader>
                  <CardTitle>{b.reviewReceived}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="text-chart-1" aria-label={L.stars[r.review.rating - 1]} dir="ltr">
                    {"★".repeat(r.review.rating)}
                    <span className="text-muted-foreground/40">{"★".repeat(5 - r.review.rating)}</span>
                  </p>
                  {r.review.comment && <p className="mt-2">{r.review.comment}</p>}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="content-start">
            <CardHeader>
              <CardTitle>{b.history}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingHistory rows={r.history} locale={locale} statuses={b.providerStatuses} by={b.historyBy} clientId={r.clientId} />
            </CardContent>
          </Card>
        </div>
      </DecisionFeedback>
    </div>
  );
}
