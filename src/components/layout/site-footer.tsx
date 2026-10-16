import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { localeLabel, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { SearchChip } from "@/components/marketing/search-chip";

/** Four-point star between marquee words, in the rose accent. */
function Star() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-[0.55em] shrink-0 animate-[spin_12s_linear_infinite]">
      <defs>
        <linearGradient id="footer-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e7a2b3" />
          <stop offset="1" stopColor="#8e3249" />
        </linearGradient>
      </defs>
      <path d="M16 0c1.2 8.6 7.4 14.8 16 16-8.6 1.2-14.8 7.4-16 16-1.2-8.6-7.4-14.8-16-16C8.6 14.8 14.8 8.6 16 0Z" fill="url(#footer-star)" />
    </svg>
  );
}

/**
 * Footer (owner's picture 2): a scrolling call to action in letters filled with a salon photograph,
 * a photo band beneath it, and a smoky-glass card overlapping the band. It sits on the floral page.
 */
export function SiteFooter({ locale, dict, categoryNames }: { locale: Locale; dict: Dictionary; categoryNames: Record<CategorySlug, string> }) {
  const f = dict.footer;
  const link = "text-white/75 transition-colors hover:text-white";
  const label = "mb-4 text-sm text-white/50";
  const words = Array.from({ length: 4 }, () => dict.hero.primary);

  return (
    <footer className="mt-12 px-3 pb-3 sm:px-5 lg:px-8">
      {/* Marquee: clicking it opens the search, like the button it echoes. */}
      <SearchChip label={dict.hero.primary} className="block w-full overflow-hidden py-2 text-start">
        <span className="marquee-track flex w-max animate-[footer-marquee_38s_linear_infinite] items-center rtl:animate-[footer-marquee-rtl_38s_linear_infinite]" aria-hidden="true">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex items-center">
              {words.map((w, i) => (
                <span key={i} className="flex items-center gap-[0.35em] pe-[0.35em]">
                  <span className="type-display whitespace-nowrap bg-[linear-gradient(rgb(122_40_62/0.5),rgb(122_40_62/0.5)),url('/images/hero/chapter-25.jpg')] bg-cover bg-center bg-clip-text text-[clamp(3.2rem,9vw,8rem)] uppercase leading-[1.05] text-transparent">
                    {w}
                  </span>
                  <span className="text-[clamp(3.2rem,9vw,8rem)]">
                    <Star />
                  </span>
                </span>
              ))}
            </span>
          ))}
        </span>
      </SearchChip>

      <div className="relative mx-auto max-w-[1400px]">
        <div
          aria-hidden="true"
          className="h-[clamp(9rem,20vw,16rem)] rounded-t-[36px] bg-[url('/images/hero/chapter-3.jpg')] bg-cover bg-[center_35%] shadow-(--shadow-soft)"
        />
        <div className="glass-dark relative -mt-16 rounded-[36px] px-6 pt-10 pb-6 sm:px-10 md:-mt-20 md:px-12 md:pt-12">
          <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,2.4fr))]">
            <div>
              <p className="flex items-center gap-3" dir="ltr">
                <span className="glass-dark-inner grid size-10 place-items-center rounded-full">
                  <span className="type-display text-sm tracking-[0.06em]">WC</span>
                </span>
                <span className="type-display text-2xl uppercase tracking-[0.22em]">{dict.brand.name}</span>
              </p>
              <p className="mt-4 max-w-[22rem] text-sm leading-relaxed text-white/70">{f.tagline}</p>
              <p lang="en" dir="ltr" className="mt-5 font-[family-name:var(--font-cormorant)] text-lg italic text-[#f6c9d3] rtl:text-end">
                {dict.brand.signature}
              </p>
            </div>

            <nav aria-label={f.company}>
              <p className={label}>{f.company}</p>
              <ul className="grid gap-2.5 text-[0.95rem]">
                <li>
                  <Link href={`/${locale}/about-platform`} className={link}>
                    {dict.nav.about}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/about-services`} className={link}>
                    {dict.nav.forPros}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/legal/privacy`} className={link}>
                    {f.privacy}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/legal/terms`} className={link}>
                    {f.terms}
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label={f.services}>
              <p className={label}>{f.services}</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[0.95rem] md:grid-cols-1">
                {categorySlugs.map((slug) => (
                  <li key={slug}>
                    <Link href={`/${locale}/${slug}`} className={link}>
                      {categoryNames[slug]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className={label}>{f.contact}</p>
              <ul className="grid gap-3 text-[0.95rem]">
                <li>
                  <Link href={`/${locale}/contact`} className={`${link} inline-flex items-center gap-2`}>
                    <Mail className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {f.write}
                  </Link>
                </li>
                <li className="flex items-start gap-2 text-white/75">
                  <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {f.coverage}
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col-reverse gap-4 border-t border-white/12 pt-5 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {dict.brand.name}. {f.rights}
            </p>
            <ul className="flex gap-4" aria-label={f.languages}>
              {locales.map((l) => (
                <li key={l}>
                  <Link href={`/${l}`} hrefLang={l} lang={l} aria-current={l === locale ? "page" : undefined} className={l === locale ? "text-white" : link}>
                    {localeLabel[l]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
