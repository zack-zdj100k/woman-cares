import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Check, Plus, ShieldCheck } from "lucide-react";
import { categoryArt, categorySlugs, isCategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getDictionary, getPagesDictionary, type Dictionary, type PagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { formatDzd } from "@/lib/format";
import { getPublicPricing } from "@/server/services/pricing";
import { PageShell } from "@/components/layout/page-shell";
import { OrbitFilm } from "@/components/marketing/orbit-film";
import { Reveal } from "@/components/marketing/reveal";
import { SnapGallery } from "@/components/marketing/snap-gallery";
import { ArrowDot, buttonClass } from "@/components/ui/button";
import { FilmTitle } from "@/components/ui/film-title";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPagesDictionary(await getLocale());
  return { title: pages.aboutServices.metaTitle, description: pages.aboutServices.intro };
}

/*
 * Pour les pros (owner's picture 7): film hero with an orbit badge, numbered cards, a sliding
 * gallery per trade, a dark card with an example request, numbered questions, live pricing.
 */
export default async function AboutServicesPage() {
  const locale = await getLocale();
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  const s = pages.aboutServices;
  const signUp = `/${locale}/auth/sign-up?role=provider`;
  const numbered = s.benefits.slice(0, 3);
  const questions = s.benefits.slice(3);
  const numberedImages = ["/images/hero/chapter-17.jpg", "/images/hero/chapter-3.jpg", "/images/hero/chapter-25.jpg"];

  return (
    <PageShell>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 pt-4 pb-20 sm:px-8 lg:px-12">
        {/* Hero */}
        <section className="relative grid grid-cols-[minmax(0,1fr)] min-h-[36rem] items-center gap-12 overflow-hidden rounded-[36px] p-8 text-white shadow-(--shadow-float) sm:p-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:p-16">
          <Image src="/images/hero/chapter-10.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-r from-[rgb(var(--scrim)/0.62)] via-[rgb(var(--scrim)/0.3)] to-[rgb(var(--scrim)/0.15)] rtl:bg-linear-to-l" />
          <div className="relative max-w-[40rem] [text-shadow:0_2px_24px_rgb(22_10_16/0.4)]">
            <h1 className="type-display text-[clamp(2.8rem,6vw,5.4rem)]">{s.title}</h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-white/85">{s.intro}</p>
            <Link href={signUp} className={buttonClass({ variant: "media", size: "lg", className: "mt-9 pe-4" })}>
              {s.cta}
              <ArrowDot tone="dark" />
            </Link>
          </div>
          <div className="relative py-10">
            <OrbitFilm labels={s.orbit} play={s.play} pause={s.pause} />
          </div>
        </section>

        {/* Three numbered cards + pricing teaser */}
        <section aria-labelledby="features-title" className="card-soft grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[36px] p-5 sm:p-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <h2 id="features-title" className="sr-only">
            {s.featuresTitle}
          </h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
            {numbered.map((b, i) => (
              <Reveal as="li" key={b.title} delay={i * 0.08} className="group relative min-h-[16rem] overflow-hidden rounded-[24px] text-white">
                <Image src={numberedImages[i]} alt="" fill sizes="(min-width: 640px) 25vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-[rgb(var(--scrim)/0.8)] via-[rgb(var(--scrim)/0.2)] to-transparent" />
                <div className="absolute inset-x-5 bottom-5">
                  <p className="text-sm tabular-nums text-white/80" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 font-medium">{b.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-white/80">{b.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <div className="flex flex-col justify-between gap-6 p-2">
            <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-surface-2" aria-hidden="true" />}>
              <PricingTeaser locale={locale} s={s} />
            </Suspense>
            <p className="flex gap-3 text-sm leading-relaxed text-ink-2">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-rose" strokeWidth={1.75} aria-hidden="true" />
              {s.regulatedNote}
            </p>
          </div>
        </section>

        {/* Discover: one slide per trade */}
        <section aria-labelledby="discover-title" className="grid grid-cols-[minmax(0,1fr)] gap-8 py-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center">
          <div className="px-2">
            <FilmTitle id="discover-title" text={s.discoverTitle} image="/images/hero/chapter-17.jpg" className="text-[clamp(2.4rem,4.4vw,3.8rem)]" />
            <p className="mt-5 max-w-[26rem] leading-relaxed text-ink-2">{s.discoverBody}</p>
          </div>
          <SnapGallery previous={s.previous} next={s.next} rtl={locale === "ar"}>
            {categorySlugs.map((slug) => (
              <li key={slug} className="w-[min(17rem,70vw)] shrink-0 snap-start">
                <Link prefetch href={`/${locale}/${slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-[24px] shadow-(--shadow-soft)">
                  <Image src={categoryArt[slug].image} alt="" fill sizes="17rem" className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-105" />
                  <span className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/85 px-4 py-3 text-sm font-medium backdrop-blur-md">{dict.categories[slug].name}</span>
                </Link>
              </li>
            ))}
          </SnapGallery>
        </section>

        {/* Dark card with an example request (clearly labelled as an example) */}
        <section aria-labelledby="requests-title" className="relative grid grid-cols-[minmax(0,1fr)] gap-10 overflow-hidden rounded-[36px] bg-[#1d1316] p-6 text-[#f6ece6] shadow-(--shadow-float) sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:p-14">
          <Image src="/images/hero/chapter-25.jpg" alt="" fill sizes="100vw" className="object-cover opacity-35" />
          <div className="absolute inset-0 bg-linear-to-r from-[#1d1316] via-[#1d1316]/70 to-[#1d1316]/30 rtl:bg-linear-to-l" />
          <Reveal className="relative max-w-sm self-center rounded-[24px] bg-white p-5 text-ink shadow-[0_30px_70px_-30px_rgb(0_0_0/0.8)]">
            <p className="text-xs text-ink-2">{s.previewEyebrow}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-lg font-medium">{s.previewTitle}</p>
              <span className="grid size-8 place-items-center rounded-full bg-surface-2">
                <Check className="size-4 text-rose" strokeWidth={2} />
              </span>
            </div>
            <dl className="mt-4 divide-y divide-line text-sm">
              {s.previewRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-2">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <span aria-hidden="true" className={buttonClass({ variant: "solid", size: "sm", className: "pointer-events-none mt-4 w-full" })}>
              {s.previewAccept}
            </span>
          </Reveal>
          <div className="relative self-center">
            <h2 id="requests-title" className="type-display text-[clamp(2.4rem,4.4vw,3.8rem)]">
              {s.requestsTitle}
            </h2>
            <p className="mt-5 max-w-[32rem] text-lg leading-relaxed text-[#f6ece6]/75">{s.requestsBody}</p>
            <Link href={signUp} className={buttonClass({ variant: "media", size: "lg", className: "mt-8 pe-4" })}>
              {s.cta}
              <ArrowDot tone="dark" />
            </Link>
          </div>
        </section>

        {/* Numbered questions + full pricing */}
        <section aria-labelledby="more-title" className="grid grid-cols-[minmax(0,1fr)] gap-8 py-10 lg:grid-cols-2">
          <div>
            <h2 id="more-title" className="type-display mb-6 text-[clamp(2.2rem,4vw,3.2rem)]">
              {s.moreTitle}
            </h2>
            <div className="grid gap-3">
              {questions.map((q, i) => (
                <details key={q.title} className="card-soft group rounded-[22px] px-5" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                    <span className="flex items-baseline gap-3">
                      <span className="text-sm tabular-nums text-ink-2" dir="ltr">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {q.title}
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_1px_0_white,0_6px_14px_-8px_rgb(74_32_46/0.5)] transition-transform duration-500 group-open:rotate-45">
                      <Plus className="size-4" strokeWidth={1.75} />
                    </span>
                  </summary>
                  <p className="pb-5 ps-8 leading-relaxed text-ink-2">{q.body}</p>
                </details>
              ))}
            </div>
            <p className="card-soft mt-4 rounded-[22px] px-5 py-4 text-sm leading-relaxed text-ink-2">{s.noPromise}</p>
          </div>
          <div id="tarifs">
            <h2 className="type-display mb-6 text-[clamp(2.2rem,4vw,3.2rem)]">{s.pricingTitle}</h2>
            <Suspense fallback={<div className="h-80 animate-pulse rounded-[28px] bg-surface" aria-hidden="true" />}>
              <Pricing locale={locale} s={s} dict={dict} />
            </Suspense>
          </div>
        </section>

        {/* Gallery */}
        <section aria-labelledby="gallery-title" className="card-soft rounded-[36px] p-5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 id="gallery-title" className="type-display text-[clamp(2rem,3.6vw,3rem)]">
              {s.galleryTitle}
            </h2>
            <Link href={signUp} className={buttonClass({ variant: "solid", className: "pe-4" })}>
              {s.cta}
              <ArrowDot />
            </Link>
          </div>
          <ul className="grid auto-rows-[9rem] grid-cols-2 gap-3 md:auto-rows-[11rem] md:grid-cols-4">
            {["/images/hero/chapter-3.jpg", "/images/hero/chapter-17.jpg", "/images/hero/chapter-25.jpg", "/images/hero/chapter-10.jpg", "/images/hero/pro-cta-nails.jpg"].map((src, i) => (
              <li key={src} className={`relative overflow-hidden rounded-[20px] ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                <Image src={src} alt="" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

async function PricingTeaser({ locale, s }: { locale: Locale; s: PagesDictionary["aboutServices"] }) {
  await connection();
  const pricing = await getPublicPricing();
  const lowest = pricing.categories.map((c) => Number(c.monthlyPrice)).sort((a, b) => a - b)[0];
  return (
    <div>
      {pricing.trialDays ? <p className="type-display text-[clamp(1.8rem,2.6vw,2.4rem)] leading-tight">{s.trial(pricing.trialDays)}</p> : null}
      {lowest !== undefined && (
        <p className="mt-3 text-ink-2">
          <span className="text-2xl font-medium text-ink">{formatDzd(String(lowest), locale)}</span> {s.perMonth}
        </p>
      )}
      <a href="#tarifs" className="mt-3 inline-block text-sm underline underline-offset-4 hover:text-rose-ink">
        {s.pricingTitle}
      </a>
    </div>
  );
}

async function Pricing({ locale, s, dict }: { locale: Locale; s: PagesDictionary["aboutServices"]; dict: Dictionary }) {
  await connection(); // prices change from the Admin dashboard; read them per request (cached briefly)
  const pricing = await getPublicPricing();
  if (pricing.categories.length === 0) return <p className="text-lg text-ink-2">{s.pricingUnavailable}</p>;

  return (
    <div className="card-soft rounded-[28px] p-7 md:p-9">
      <p className="max-w-[36rem] leading-relaxed text-ink-2">{s.pricingIntro}</p>
      <dl className="mt-6 divide-y divide-line">
        {pricing.categories.map((c) =>
          isCategorySlug(c.slug) ? (
            <div key={c.slug} className="flex items-baseline justify-between gap-6 py-3.5">
              <dt>{dict.categories[c.slug].name}</dt>
              <dd>
                <span className="font-medium">{formatDzd(c.monthlyPrice, locale)}</span> <span className="text-sm text-ink-2">{s.perMonth}</span>
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      {pricing.graceDays ? <p className="mt-5 text-sm leading-relaxed text-ink-2">{s.grace(pricing.graceDays)}</p> : null}
    </div>
  );
}
