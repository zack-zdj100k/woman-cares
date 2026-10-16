"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { localeLabel, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { buttonClass } from "@/components/ui/button";
import { useFindCareOptional } from "@/components/marketing/find-care";
import { cn } from "@/lib/cn";
import { LocaleSwitch } from "./locale-switch";

type Props = {
  locale: Locale;
  nav: Dictionary["nav"];
  findLabel: string;
  brand: string;
  categoryNames: Record<CategorySlug, string>;
  /** Transparent over the hero film until the element with id="hero-end" scrolls away. */
  overlay?: boolean;
  /** Server-rendered account control (sign-in link or account menu), streamed behind Suspense. */
  account?: ReactNode;
  mobileAccount?: ReactNode;
};

export function SiteHeader({ locale, nav, findLabel, brand, categoryNames, overlay = false, account, mobileAccount }: Props) {
  const findCare = useFindCareOptional();
  const reduce = useReducedMotion();
  const [solid, setSolid] = useState(!overlay);
  const [menuOpen, setMenuOpen] = useState(false);
  const [careOpen, setCareOpen] = useState(false);
  const careRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlay) return;
    const end = document.getElementById("hero-end");
    if (!end) return;
    // Solid once the bottom of the hero passes under the header.
    const io = new IntersectionObserver(([e]) => setSolid(e.boundingClientRect.top < 80), {
      rootMargin: "-80px 0px 0px 0px",
      threshold: [0, 1],
    });
    io.observe(end);
    return () => io.disconnect();
  }, [overlay]);

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

  useEffect(() => {
    document.documentElement.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [menuOpen]);

  const onMedia = !solid && !menuOpen;
  const otherLocale = locales.find((l) => l !== locale)!;

  const pill = cn(
    "whitespace-nowrap rounded-full px-3.5 py-2 text-[0.92rem] transition-colors duration-300 xl:px-4",
    onMedia ? "text-on-media/90 hover:bg-on-media/15 hover:text-on-media" : "text-ink-2 hover:bg-ink/5 hover:text-ink",
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,color] duration-500",
        onMedia ? "text-on-media" : "bg-ground/90 text-ink shadow-[0_1px_0_var(--line)] backdrop-blur-xl",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ground"
      >
        {nav.skip}
      </a>
      <div
        className={cn(
          "mx-auto flex h-[4.5rem] max-w-[1480px] items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] px-5 transition-[padding] duration-500 sm:px-8 lg:px-14",
          onMedia && "lg:pt-3",
        )}
      >
        {/* Start: pill cluster */}
        <nav aria-label="Principal" className="hidden lg:block">
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border p-1 transition-colors duration-500",
              onMedia ? "border-on-media/20 bg-[rgb(var(--scrim)/0.18)] backdrop-blur-md" : "border-line",
            )}
          >
            <div ref={careRef} className="relative">
              <button
                type="button"
                aria-expanded={careOpen}
                aria-controls="care-menu"
                onClick={() => setCareOpen((o) => !o)}
                className={cn(pill, "inline-flex items-center gap-1.5")}
              >
                {nav.care}
                <ChevronDown
                  className={cn("size-3.5 transition-transform duration-300", careOpen && "rotate-180")}
                  strokeWidth={1.75}
                />
              </button>
              <AnimatePresence>
                {careOpen && (
                  <motion.div
                    id="care-menu"
                    initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute start-0 top-[calc(100%+0.75rem)] w-[22rem] origin-top-left rounded-[22px] border border-line bg-ground p-2 text-ink shadow-[0_30px_80px_-30px_rgb(37_22_29/0.45)]"
                  >
                    <ul className="grid grid-cols-2 gap-1">
                      {categorySlugs.map((slug) => (
                        <li key={slug}>
                          <Link
                            href={`/${locale}/${slug}`}
                            onClick={() => setCareOpen(false)}
                            className="block rounded-2xl px-4 py-3 text-[0.95rem] transition-colors hover:bg-surface"
                          >
                            {categoryNames[slug]}
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
          </div>
        </nav>

        {/* Mobile: wordmark at start */}
        <Link
          href={`/${locale}`}
          className="type-display whitespace-nowrap text-[1.3rem] uppercase tracking-[0.2em] lg:hidden"
          dir="ltr"
        >
          {brand}
        </Link>

        {/* Center wordmark (desktop) */}
        <Link
          href={`/${locale}`}
          className="type-display hidden whitespace-nowrap text-[1.6rem] uppercase tracking-[0.28em] lg:block"
          dir="ltr"
        >
          {brand}
        </Link>

        {/* End actions */}
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <LocaleSwitch
            target={otherLocale}
            className={cn(pill, "hidden sm:inline-flex")}
            aria-label={`${nav.language}: ${localeLabel[otherLocale]}`}
          />
          <span className={cn("hidden lg:inline-flex", onMedia ? "text-on-media" : "text-ink")}>
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
              className={buttonClass({ variant: onMedia ? "media" : "solid", size: "sm", className: "max-md:hidden" })}
            >
              <Search className="size-4" strokeWidth={1.75} />
              {findLabel}
            </button>
          ) : (
            <Link
              href={`/${locale}/coiffeuses`}
              className={buttonClass({ variant: onMedia ? "media" : "solid", size: "sm", className: "max-md:hidden" })}
            >
              <Search className="size-4" strokeWidth={1.75} />
              {findLabel}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? nav.close : nav.menu}
            className={cn(
              "relative z-10 grid size-11 place-items-center rounded-full border transition-colors lg:hidden",
              onMedia ? "border-on-media/30 bg-[rgb(var(--scrim)/0.2)] backdrop-blur-md" : "border-line",
            )}
          >
            {menuOpen ? <X className="size-5" strokeWidth={1.75} /> : <Menu className="size-5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-[4.5rem] overflow-y-auto bg-ground px-5 pb-10 pt-4 text-ink sm:px-8 lg:hidden"
          >
            <nav aria-label={nav.menu} className="grid gap-8">
              <div>
                <p className="mb-3 text-sm text-ink-2">{nav.care}</p>
                <ul className="grid gap-1">
                  {categorySlugs.map((slug, i) => (
                    <motion.li
                      key={slug}
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link
                        href={`/${locale}/${slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="type-display block py-1.5 text-4xl"
                      >
                        {categoryNames[slug]}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </div>
              <ul className="grid gap-3 text-lg">
                <li>
                  <Link href={`/${locale}/about-platform`} onClick={() => setMenuOpen(false)}>
                    {nav.about}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/about-services`} onClick={() => setMenuOpen(false)}>
                    {nav.forPros}
                  </Link>
                </li>
                <li onClick={() => setMenuOpen(false)}>
                  {mobileAccount ?? <Link href={`/${locale}/auth/sign-in`}>{nav.signIn}</Link>}
                </li>
                <li>
                  <LocaleSwitch target={otherLocale} />
                </li>
              </ul>
              <div className="grid gap-3">
                {findCare && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      findCare.open();
                    }}
                    className={buttonClass({ variant: "solid", size: "lg", className: "w-full" })}
                  >
                    <Search className="size-4" strokeWidth={1.75} />
                    {findLabel}
                  </button>
                )}
                <Link
                  href={`/${locale}/auth/sign-up?role=provider`}
                  onClick={() => setMenuOpen(false)}
                  className={buttonClass({ variant: "outline", size: "lg", className: "w-full" })}
                >
                  {nav.join}
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
