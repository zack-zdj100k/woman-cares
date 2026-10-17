import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, MapPin, Search, Send, Sparkles } from "lucide-react";
import { categoryArt, categorySlugs } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { getCategoryCounts } from "@/server/services/discovery";
import { FilmTitle } from "@/components/ui/film-title";
import { Reveal } from "./reveal";
import { SearchChip } from "./search-chip";

/**
 * Opening section after the film (owner's picture 5, top): the title and the list of the six
 * universes on one side, a large photograph with floating glass chips on the other.
 */
export function HomeIntro({ locale, copy, categories }: { locale: Locale; copy: Dictionary["home"]["intro"]; categories: Dictionary["categories"] }) {
  const chip = "inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/25 px-3 py-2 text-sm text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] backdrop-blur-md transition-colors hover:bg-white/35";
  return (
    <section aria-labelledby="intro-title" className="mx-auto max-w-[1400px] px-4 pt-24 pb-20 sm:px-8 md:pt-32 lg:px-12">
      <div className="card-soft grid grid-cols-[minmax(0,1fr)] gap-8 rounded-[36px] p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 lg:p-8">
        <div className="flex flex-col px-2 pt-2 sm:px-4">
          <FilmTitle id="intro-title" text={copy.title} image="/images/hero/chapter-3.jpg" className="text-[clamp(2.6rem,5.2vw,4.6rem)]" />
          <div className="mt-10 flex items-center gap-3">
            <p className="text-sm font-medium">{copy.services}</p>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {categorySlugs.map((slug) => (
              <li key={slug}>
                <Link prefetch href={`/${locale}/${slug}`} className="group flex items-center gap-4 py-3">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-2xl bg-surface-2 shadow-[0_6px_14px_-8px_rgb(74_32_46/0.5)]">
                    <Image src={categoryArt[slug].image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{categories[slug].name}</span>
                    <span className="block truncate text-sm text-ink-2">{categories[slug].short}</span>
                  </span>
                  <Suspense fallback={null}>
                    <Count slug={slug} copy={copy} />
                  </Suspense>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_1px_0_white,0_6px_14px_-8px_rgb(74_32_46/0.5)] transition-transform duration-500 ease-(--ease-soft) group-hover:rotate-45 rtl:group-hover:-rotate-45">
                    <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Reveal className="relative min-h-[26rem] overflow-hidden rounded-[28px] lg:min-h-[38rem]">
          <Image src="/images/hero/chapter-10.jpg" alt="" fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-b from-[rgb(var(--scrim)/0.25)] via-transparent to-[rgb(var(--scrim)/0.35)]" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
            <span className={chip}>
              <MapPin className="size-4" strokeWidth={1.75} />
              {copy.location}
            </span>
            <SearchChip className={`${chip} bg-white/90 text-ink hover:bg-white`}>
              <Sparkles className="size-4 text-rose" strokeWidth={1.75} />
              {copy.book}
            </SearchChip>
          </div>
          <SearchChip
            label={copy.search}
            className="float-soft absolute inset-x-6 top-1/2 mx-auto flex max-w-md -translate-y-1/2 items-center gap-3 rounded-full bg-white/92 px-5 py-3.5 text-start text-ink-2 shadow-(--shadow-float)"
          >
            <Search className="size-4 shrink-0 text-ink" strokeWidth={1.75} />
            <span className="truncate">{copy.search}</span>
          </SearchChip>
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-2">
            <Link href={`/${locale}/contact`} className={chip}>
              <Send className="size-4" strokeWidth={1.75} />
              {copy.write}
            </Link>
            <Link href={`/${locale}/auth/sign-up?role=provider`} className={chip}>
              {copy.join}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

async function Count({ slug, copy }: { slug: string; copy: Dictionary["home"]["intro"] }) {
  await connection();
  const n = (await getCategoryCounts())[slug] ?? 0;
  if (!n) return null;
  return <span className="shrink-0 rounded-full border border-line bg-white/70 px-2.5 py-1 text-xs text-ink-2">{copy.profiles(n)}</span>;
}
