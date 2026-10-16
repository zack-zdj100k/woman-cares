import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { specialtiesByCategory } from "@/config/specialties";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { InViewVideo } from "./in-view-video";
import { Reveal } from "./reveal";

/** A featured treatment around a round film (owner's picture 5, "popular procedure"). */
export function Spotlight({ locale, copy, category }: { locale: Locale; copy: Dictionary["home"]["spotlight"]; category: Dictionary["categories"]["nails"] }) {
  const tags = specialtiesByCategory.nails.slice(0, 5).map((s) => s[locale]);
  return (
    <section aria-labelledby="spotlight-title" className="mx-auto max-w-[1300px] px-4 py-16 sm:px-8 md:py-24">
      <p className="mb-6 text-sm text-ink-2">{copy.eyebrow}</p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 border-t border-line pt-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-14">
        <Reveal>
          <h2 id="spotlight-title" className="type-display text-[clamp(2.8rem,5vw,4.6rem)] uppercase">
            {category.name}
          </h2>
          <p className="mt-8 text-sm font-medium">{copy.specialties}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <li key={t} className="rounded-full bg-white/80 px-3.5 py-1.5 text-sm shadow-[inset_0_1px_0_white,0_6px_14px_-10px_rgb(74_32_46/0.5)]">
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="relative mx-auto aspect-square w-[min(22rem,78vw)]">
          <span aria-hidden="true" className="absolute -inset-4 rounded-full border border-ink/10" />
          <div className="absolute inset-0 overflow-hidden rounded-full shadow-(--shadow-float)">
            <InViewVideo src="/media/pro-cta-nails.mp4" poster="/images/hero/pro-cta-nails.jpg" className="absolute inset-0 size-full object-cover" />
          </div>
        </Reveal>
        <Reveal delay={0.2} className="lg:ps-6">
          <p className="max-w-[24rem] text-lg leading-relaxed text-ink-2">{category.caption}</p>
          <Link href={`/${locale}/nails`} className="group mt-8 inline-flex items-center gap-3 text-[0.95rem] font-medium">
            {copy.more}
            <span className="grid size-10 place-items-center rounded-full bg-[linear-gradient(180deg,#4a3540,#1d1116)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_8px_16px_-8px_rgb(29_17_22/0.7)] transition-transform duration-500 group-hover:rotate-45 rtl:group-hover:-rotate-45">
              <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
