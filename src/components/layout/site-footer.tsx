import Link from "next/link";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { localeLabel, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";

export function SiteFooter({
  locale,
  dict,
  categoryNames,
}: {
  locale: Locale;
  dict: Dictionary;
  categoryNames: Record<CategorySlug, string>;
}) {
  const f = dict.footer;
  const link = "text-on-wine/75 transition-colors hover:text-on-wine";
  return (
    <footer className="bg-wine text-on-wine">
      <div className="mx-auto max-w-[1480px] px-5 pb-10 sm:px-8 lg:px-14">
        <div className="grid gap-12 border-t border-on-wine/15 pt-16 md:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,2fr))]">
          <div>
            <p dir="ltr" className="type-display text-3xl uppercase tracking-[0.24em] rtl:text-end">
              {dict.brand.name}
            </p>
            <p className="mt-4 max-w-[22rem] text-on-wine/75">{f.tagline}</p>
            <p lang="en" dir="ltr" className="mt-6 font-[family-name:var(--font-cormorant)] text-xl italic text-on-wine/90 rtl:text-end">
              {dict.brand.signature}
            </p>
          </div>
          <nav aria-label={f.explore}>
            <p className="mb-4 text-sm text-on-wine/55">{f.explore}</p>
            <ul className="grid gap-2.5">
              {categorySlugs.map((slug) => (
                <li key={slug}>
                  <Link href={`/${locale}/${slug}`} className={link}>
                    {categoryNames[slug]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={f.company}>
            <p className="mb-4 text-sm text-on-wine/55">{f.company}</p>
            <ul className="grid gap-2.5">
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
                <Link href={`/${locale}/contact`} className={link}>
                  {f.contact}
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label={f.legal}>
            <p className="mb-4 text-sm text-on-wine/55">{f.legal}</p>
            <ul className="grid gap-2.5">
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
        </div>
        <div className="mt-16 flex flex-col-reverse gap-4 border-t border-on-wine/15 pt-6 text-sm text-on-wine/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {dict.brand.name}. {f.rights}
          </p>
          <ul className="flex gap-4">
            {locales.map((l) => (
              <li key={l}>
                <Link
                  href={`/${l}`}
                  hrefLang={l}
                  lang={l}
                  aria-current={l === locale ? "page" : undefined}
                  className={l === locale ? "text-on-wine" : link}
                >
                  {localeLabel[l]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
