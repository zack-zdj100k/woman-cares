import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getPagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth/session";
import { getClientBooking } from "@/server/services/booking-views";
import { ForbiddenError } from "@/server/services/admin-users";
import { PageShell } from "@/components/layout/page-shell";
import { buttonClass } from "@/components/ui/button";

type Params = PageProps<"/[locale]/booking/sent/[bookingId]">["params"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getPagesDictionary(await getLocale());
  return { title: t.profile.book.sentTitle, robots: { index: false } };
}

/** The confirmation of a request, on its own page so nothing else competes with it. */
export default function BookingSentPage({ params, searchParams }: PageProps<"/[locale]/booking/sent/[bookingId]">) {
  return (
    <PageShell>
      <Suspense fallback={<div className="mx-auto h-[26rem] max-w-[38rem]" aria-hidden="true" />}>
        <Sent params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Sent({ params, searchParams }: { params: Params; searchParams: PageProps<"/[locale]/booking/sent/[bookingId]">["searchParams"] }) {
  const { locale: l, bookingId } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireUser(locale, `/${locale}/booking/sent/${bookingId}`);
  const t = await getPagesDictionary(locale);
  const copy = t.profile.book;

  let booking: Awaited<ReturnType<typeof getClientBooking>>;
  try {
    booking = await getClientBooking(user, bookingId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  if (!booking) notFound();

  const photos = (await searchParams).photos;
  const rows: [string, ReactNode][] = [
    [copy.service, booking.serviceNameSnap],
    [copy.day, formatDate(booking.startAt, locale, { weekday: "long", day: "numeric", month: "long" })],
    [copy.time, <span key="t" dir="ltr">{formatDate(booking.startAt, locale, { hour: "2-digit", minute: "2-digit" })}</span>],
    [copy.reference, <span key="r" dir="ltr" className="font-medium tabular-nums">{booking.reference}</span>],
    [copy.status, copy.statusPending],
  ];

  return (
    <section className="mx-auto grid max-w-[38rem] gap-5 px-5 py-10 sm:px-8 md:py-16" aria-labelledby="sent-title">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#c25a73,#8e3249)] text-white shadow-[0_10px_24px_-10px_rgb(142_50_73/0.7)]">
          <CalendarCheck className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 id="sent-title" className="type-display text-[clamp(1.8rem,4vw,2.6rem)]">
          {copy.sentTitle}
        </h1>
      </div>

      <dl className="card-soft grid gap-2 rounded-(--radius-media) p-5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-end">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm leading-relaxed text-ink-2">{copy.done}</p>
      {photos === "sent" && <p className="text-sm text-ink-2">{copy.photosSent}</p>}
      {photos === "failed" && (
        <p role="alert" className="text-sm text-rose-ink">
          {copy.photosFailed}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/dashboard/client/appointments/${booking.id}`} className={buttonClass({ variant: "solid", size: "sm" })}>
          {copy.seeOne}
        </Link>
        <Link href={`/${locale}/dashboard/client/appointments`} className={buttonClass({ variant: "outline", size: "sm" })}>
          {copy.seeMine}
        </Link>
        <Link href={`/${locale}/profiles/${booking.profile.slug}#reserver`} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {copy.another}
        </Link>
      </div>
    </section>
  );
}
