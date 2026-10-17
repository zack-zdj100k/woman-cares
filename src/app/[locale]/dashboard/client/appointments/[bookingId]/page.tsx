import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { clientActions } from "@/lib/booking-rules";
import { getClientBooking } from "@/server/services/booking-views";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { BookingHistory, priceRange, StatusBadge, whenLong } from "@/components/dashboard/booking-ui";
import { bookingLabels } from "@/components/dashboard/booking-labels";
import { ClientCancelForm, ProposalAnswer, ReviewForm } from "@/components/dashboard/booking-forms";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDashboardDictionary(await getLocale());
  return { title: d.bookings.appointments, robots: { index: false } };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/client/appointments/[bookingId]">) {
  return (
    <Appointment params={params} />
  );
}

async function Appointment({ params }: { params: PageProps<"/[locale]/dashboard/client/appointments/[bookingId]">["params"] }) {
  const { locale: l, bookingId } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "client", `/${locale}/dashboard/client/appointments/${bookingId}`);
  const [d, site, r] = await Promise.all([getDashboardDictionary(locale), getDictionary(locale), getClientBooking(user, bookingId)]);
  const b = d.bookings;
  const back = `/${locale}/dashboard/client/appointments`;
  const backLink = (
    <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
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
  const actions = clientActions({ status: r.status, startAt: r.startAt, hasReview: Boolean(r.review) }, new Date());
  const L = bookingLabels(b);
  const category = site.categories[r.profile.category.slug as CategorySlug]?.name ?? r.profile.category.slug;

  return (
    <div className={pageClass}>
      {backLink}
      <PageHeader
        title={r.serviceNameSnap}
        description={`${r.profile.provider.businessName} · ${category}`}
        actions={<StatusBadge status={r.status} labels={b.clientStatuses} />}
      />
      <DecisionFeedback>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-6">
            {actions.includes("acceptProposal") && r.proposedStartAt && (
              <Card className="border-chart-1/40">
                <CardHeader>
                  <CardTitle>{b.proposalTitle}</CardTitle>
                  <CardDescription>{b.proposalHint}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <p className="text-lg font-medium tabular-nums">{whenLong(r.proposedStartAt, locale)}</p>
                  {r.providerNote && <p className="rounded-xl bg-white/4 px-4 py-3 text-sm">{r.providerNote}</p>}
                  <ProposalAnswer bookingId={r.id} l={L} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{b.columns.when}</p>
                  <p className="mt-1 font-medium tabular-nums">{whenLong(r.startAt, locale)}</p>
                  <p className="text-muted-foreground">{b.minutes(r.durationMinSnap)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{b.columns.price}</p>
                  <p className="mt-1 font-medium tabular-nums">{priceRange(r.priceMinSnap, r.priceMaxSnap, locale)}</p>
                  <p className="text-muted-foreground">{b.paymentStatuses[r.paymentStatus]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{b.reference}</p>
                  <p className="mt-1 font-medium" dir="ltr">
                    {r.reference}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{b.columns.professional}</p>
                  <Link href={`/${locale}/profiles/${r.profile.slug}`} className="mt-1 block font-medium hover:underline">
                    {r.profile.provider.businessName}
                  </Link>
                </div>
                {r.clientNote && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">{b.clientNote}</p>
                    <p className="mt-1">{r.clientNote}</p>
                  </div>
                )}
                {r.providerNote && r.status !== "RESCHEDULE_PROPOSED" && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">{b.providerNote}</p>
                    <p className="mt-1">{r.providerNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {actions.includes("review") && (
              <Card>
                <CardHeader>
                  <CardTitle>{b.review}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReviewForm bookingId={r.id} l={L} />
                </CardContent>
              </Card>
            )}
            {r.review && (
              <Card>
                <CardHeader>
                  <CardTitle>{b.yourReview}</CardTitle>
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
            {actions.includes("cancel") && (
              <div>
                <ClientCancelForm bookingId={r.id} l={L} />
              </div>
            )}
          </div>

          <Card className="content-start">
            <CardHeader>
              <CardTitle>{b.history}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingHistory rows={r.history} locale={locale} statuses={b.clientStatuses} by={b.historyBy} clientId={r.clientId} />
            </CardContent>
          </Card>
        </div>
      </DecisionFeedback>
    </div>
  );
}
