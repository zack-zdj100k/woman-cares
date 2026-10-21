"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, Search } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { localeLabel, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { useFindCareOptional } from "@/components/marketing/find-care";
import { cn } from "@/lib/cn";
import { LocaleSwitch } from "./locale-switch";
import { DialMenu, openDialMenu } from "./dial-menu";
import type { AccountNav } from "./account-nav";

type Props = {
  locale: Locale;
  nav: Dictionary["nav"];
  findLabel: string;
  brand: string;
  categoryNames: Record<CategorySlug, string>;
  categories: Dictionary["categories"];
  /** The header starts over the hero film (homepage): floating text is light until it fades on scroll. */
  overMedia?: boolean;
  /** Server-rendered account control (sign-in link or account menu), streamed behind Suspense. */
  account?: ReactNode;
  /** Round account button kept beside the search and menu circles at every width. */
  accountIcon?: ReactNode;
  /** Where the menu's account entry points once the session is known. */
  accountNav?: Promise<AccountNav>;
};

export function SiteHeader({ locale, nav, findLabel, brand, categoryNames, categories, account, accountIcon, accountNav, overMedia = false }: Props) {
  const findCare = useFindCareOptional();
  const reduce = useReducedMotion();
  const [careOpen, setCareOpen] = useState(false);
  // As soon as the page moves, floating text fades so content never runs under it; round icons stay.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCompact(window.scrollY > 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  const fade = cn("transition-[opacity,visibility] duration-300", compact && "invisible opacity-0");
  const careRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!careOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!careRef.current?.contains(e.target as Node)) setCareOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCareOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [careOpen]);

  const otherLocale = locales.find((l) => l !== locale)!;
  // No bar (owner's request): links float on their own, light over the film, ink on the floral pages.
  const ink = overMedia
    ? "text-white [text-shadow:0_1px_2px_rgb(22_10_16/0.45),0_2px_18px_rgb(22_10_16/0.4)]"
    : "text-ink [text-shadow:0_1px_10px_rgb(255_250_246/0.9)]";
  const pill = cn(
    "whitespace-nowrap rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition-colors duration-300 xl:px-4",
    ink,
    overMedia ? "hover:bg-white/15" : "hover:bg-white/60",
  );
  const circle = cn(
    "grid size-11 shrink-0 place-items-center rounded-full text-white transition-[transform,background-color,box-shadow] duration-300 hover:scale-105",
    "glass-dark",
    compact && "size-12",
  );

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 lg:px-8">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ground"
      >
        {nav.skip}
      </a>
      {/* No bar: floating links and round glass buttons (owner's request, 2026-10-16). */}
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-2 px-1 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center gap-1">
          <Link href={`/${locale}`} aria-label={brand} className={circle}>
            <span className="type-display text-[1.05rem] tracking-[0.06em]" dir="ltr" aria-hidden="true">
              WC
            </span>
          </Link>
          <Link href={`/${locale}`} className={cn("type-display truncate px-2 text-[1.15rem] uppercase tracking-[0.18em] lg:hidden", ink, fade)} dir="ltr" tabIndex={compact ? -1 : undefined}>
            {brand}
          </Link>
          <nav aria-label={nav.menu} className={cn("hidden items-center gap-0.5 ps-1 lg:flex", fade)}>
            <div ref={careRef} className="relative">
              <button
                type="button"
                aria-expanded={careOpen}
                aria-controls="care-menu"
                onClick={() => setCareOpen((o) => !o)}
                className={cn(pill, "inline-flex items-center gap-1.5")}
              >
                {nav.care}
                <ChevronDown className={cn("size-3.5 transition-transform duration-300", careOpen && "rotate-180")} strokeWidth={1.75} />
              </button>
              <AnimatePresence>
                {careOpen && (
                  <motion.div
                    id="care-menu"
                    initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="glass-dark absolute start-0 top-[calc(100%+0.9rem)] w-[24rem] origin-top-left rounded-[26px] p-2"
                  >
                    <ul className="grid grid-cols-2 gap-1">
                      {categorySlugs.map((slug) => (
                        <li key={slug}>
                          <Link
                            href={`/${locale}/${slug}`}
                            prefetch
                            onClick={() => setCareOpen(false)}
                            className="block rounded-2xl px-4 py-3 transition-colors hover:bg-white/10"
                          >
                            <span className="block text-[0.95rem] text-white">{categoryNames[slug]}</span>
                            <span className="mt-0.5 line-clamp-1 block text-xs text-white/60">{categories[slug].short}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link href={`/${locale}/about-platform`} className={pill}>
              {nav.about}
            </Link>
            <Link href={`/${locale}/about-services`} className={pill}>
              {nav.forPros}
            </Link>
          </nav>
        </div>

        <Link href={`/${locale}`} className={cn("type-display hidden whitespace-nowrap text-[1.6rem] uppercase tracking-[0.26em] lg:block", ink, fade)} dir="ltr" tabIndex={compact ? -1 : undefined}>
          {brand}
        </Link>

        <div className="flex items-center justify-end gap-1.5">
          <LocaleSwitch target={otherLocale} className={cn(pill, "hidden sm:inline-flex", fade)} aria-label={`${nav.language}: ${localeLabel[otherLocale]}`} />
          <span className={cn("hidden lg:inline-flex", ink, fade)}>
            {account ?? (
              <Link href={`/${locale}/auth/sign-in`} className={pill}>
                {nav.signIn}
              </Link>
            )}
          </span>
          {findCare ? (
            <button
              type="button"
              onClick={() => findCare.open()}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full ps-3 pe-4 text-[0.92rem] text-white transition-colors hover:bg-white/15 max-md:size-11 max-md:justify-center max-md:p-0",
                "glass-dark",
                compact && "size-12 justify-center p-0",
              )}
              aria-label={findLabel}
            >
              <Search className="size-4 shrink-0" strokeWidth={1.75} />
              <span className={cn("max-md:hidden", compact && "hidden")}>{findLabel}</span>
            </button>
          ) : (
            <Link href={`/${locale}/coiffeuses`} className="glass-dark inline-flex h-11 items-center gap-2 rounded-full ps-3 pe-4 text-[0.92rem] text-white max-md:size-11 max-md:justify-center max-md:p-0" aria-label={findLabel}>
              <Search className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="max-md:hidden">{findLabel}</span>
            </Link>
          )}
          {accountIcon}
          <button type="button" onClick={openDialMenu} aria-label={nav.menu} className={circle}>
            <Menu className="size-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {/* Reads the current path, so it streams in (Cache Components). */}
      <Suspense fallback={null}>
        <DialMenu locale={locale} nav={nav} categoryNames={categoryNames} categories={categories} accountNav={accountNav} />
      </Suspense>
    </header>
  );
}
