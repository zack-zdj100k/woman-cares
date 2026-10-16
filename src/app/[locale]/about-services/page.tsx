import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { isCategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getDictionary, getPagesDictionary, type Dictionary, type PagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { formatDzd } from "@/lib/format";
import { getPublicPricing } from "@/server/services/pricing";
import { PageShell } from "@/components/layout/page-shell";
import { InViewVideo } from "@/components/marketing/in-view-video";
import { Reveal } from "@/components/marketing/reveal";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPagesDictionary(await getLocale());
  return { title: pages.aboutServices.metaTitle, description: pages.aboutServices.intro };
}

export default async function AboutServicesPage() {
  const locale = await getLocale();
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  const s = pages.aboutServices;
  const signUp = `/${locale}/auth/sign-up?role=provider`;

  return (
    <PageShell>
      <header className="mx-auto grid max-w-[1480px] items-center gap-12 px-5 pt-12 pb-20 sm:px-8 md:pt-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:px-14">
        <div>
          <h1 className="type-display text-[clamp(3rem,6.5vw,6rem)]">{s.title}</h1>
          <p className="mt-6 max-w-[38rem] text-xl leading-relaxed text-ink-2">{s.intro}</p>
          <Link href={signUp} className={buttonClass({ variant: "solid", size: "lg", className: "mt-10" })}>
            {s.cta}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
          </Link>
        </div>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[24rem] overflow-hidden rounded-(--radius-media)">
          <InViewVideo src="/media/pro-cta-nails.mp4" poster="/images/hero/pro-cta-nails.jpg" className="absolute inset-0 size-full object-cover" />
        </div>
      </header>

      <section aria-label={s.metaTitle} className="mx-auto max-w-[1480px] px-5 pb-24 sm:px-8 lg:px-14">
        <ul className="grid gap-x-16 gap-y-14 border-t border-line pt-16 md:grid-cols-2">
          {s.benefits.map((b, i) => (
            <Reveal as="li" key={b.title} delay={(i % 2) * 0.08}>
              <h2 className="type-display text-[clamp(2rem,3vw,2.75rem)]">{b.title}</h2>
              <p className="mt-3 max-w-[34rem] text-lg leading-relaxed text-ink-2">{b.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pricing-title" className="bg-parchment">
        <div className="mx-auto grid max-w-[1480px] gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-14">
          <div>
            <h2 id="pricing-title" className="type-display text-[clamp(2.75rem,5vw,4.5rem)]">
              {s.pricingTitle}
            </h2>
            <p className="mt-5 flex max-w-[30rem] gap-3 text-sm leading-relaxed text-ink-2">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-rose" strokeWidth={1.75} aria-hidden="true" />
              {s.regulatedNote}
            </p>
          </div>
          <Suspense fallback={<div className="h-80 animate-pulse rounded-(--radius-media) bg-surface" aria-hidden="true" />}>
            <Pricing locale={locale} s={s} dict={dict} />
          </Suspense>
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-20 text-center sm:px-8 md:py-24 lg:px-14">
        <p className="mx-auto max-w-[40rem] text-lg leading-relaxed text-ink-2">{s.noPromise}</p>
        <Link href={signUp} className={buttonClass({ variant: "solid", size: "lg", className: "mt-8" })}>
          {s.cta}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        </Link>
      </section>
    </PageShell>
  );
}

async function Pricing({ locale, s, dict }: { locale: Locale; s: PagesDictionary["aboutServices"]; dict: Dictionary }) {
  await connection(); // prices change from the Admin dashboard; read them per request (cached briefly)
  const pricing = await getPublicPricing();
  if (pricing.categories.length === 0) return <p className="text-lg text-ink-2">{s.pricingUnavailable}</p>;

  return (
    <div className="rounded-(--radius-media) bg-ground p-8 md:p-10">
      {pricing.trialDays ? <p className="type-display text-[clamp(1.9rem,3vw,2.6rem)]">{s.trial(pricing.trialDays)}</p> : null}
      <p className="mt-3 max-w-[36rem] leading-relaxed text-ink-2">{s.pricingIntro}</p>
      <dl className="mt-8 divide-y divide-line border-y border-line">
        {pricing.categories.map((c) =>
          isCategorySlug(c.slug) ? (
            <div key={c.slug} className="flex items-baseline justify-between gap-6 py-4">
              <dt className="text-[1.05rem]">{dict.categories[c.slug].name}</dt>
              <dd>
                <span className="font-medium">{formatDzd(c.monthlyPrice, locale)}</span>{" "}
                <span className="text-sm text-ink-2">{s.perMonth}</span>
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      {pricing.graceDays ? <p className="mt-6 text-sm leading-relaxed text-ink-2">{s.grace(pricing.graceDays)}</p> : null}
    </div>
  );
}
