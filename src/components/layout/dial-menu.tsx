"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { localeLabel, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { cn } from "@/lib/cn";

export const OPEN_MENU_EVENT = "wc:open-menu";
/** Opens the half-circle menu from anywhere (the navbar's menu button). */
export function openDialMenu() {
  window.dispatchEvent(new Event(OPEN_MENU_EVENT));
}

type Item = { href: string; label: string; short: string };
const STEP = 21; // degrees between two pages on the arc
const VISIBLE = 84; // pages further than this from the pointer are hidden

/**
 * Site menu as a half circle docked to the inline-end edge (owner's request): a small half-disc tab
 * is always there; opening it shows every page on an arc. Scroll, swipe or use the arrow keys to turn
 * the dial; the page facing the screen is highlighted and opens with Enter or a tap.
 */
export function DialMenu({
  locale,
  nav,
  categoryNames,
  categories,
}: {
  locale: Locale;
  nav: Dictionary["nav"];
  categoryNames: Record<CategorySlug, string>;
  categories: Dictionary["categories"];
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  const close = () => setOpenOn(null);
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const wheel = useRef(0);
  const touchY = useRef<number | null>(null);
  const rtl = locale === "ar";
  const other = locales.find((l) => l !== locale)!;

  const items: Item[] = useMemo(
    () => [
      { href: `/${locale}`, label: nav.dial.home, short: nav.dial.homeShort },
      ...categorySlugs.map((slug) => ({ href: `/${locale}/${slug}`, label: categoryNames[slug], short: categories[slug].short })),
      { href: `/${locale}/about-platform`, label: nav.about, short: nav.dial.aboutShort },
      { href: `/${locale}/about-services`, label: nav.forPros, short: nav.dial.prosShort },
      { href: `/${locale}/contact`, label: nav.dial.contact, short: nav.dial.contactShort },
      { href: `/${locale}/auth/sign-in`, label: nav.signIn, short: nav.dial.accountShort },
    ],
    [locale, nav, categoryNames, categories],
  );

  const show = useCallback(() => {
    const here = items.findIndex((it) => it.href === pathname);
    setActive(here >= 0 ? here : 0);
    setOpenOn(pathname);
  }, [items, pathname]);

  const turn = useCallback((by: number) => setActive((a) => Math.min(items.length - 1, Math.max(0, a + by))), [items.length]);

  useEffect(() => {
    window.addEventListener(OPEN_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_MENU_EVENT, show);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    panelRef.current?.focus();
    const tab = tabRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
      else if (e.key === "Home") setActive(0);
      else if (e.key === "End") setActive(items.length - 1);
      else if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        turn(e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      tab?.focus({ preventScroll: true });
    };
  }, [open, turn, items.length]);

  const onWheel = (e: React.WheelEvent) => {
    wheel.current += e.deltaY;
    if (Math.abs(wheel.current) >= 46) {
      turn(Math.sign(wheel.current));
      wheel.current = 0;
    }
  };
  const onTouchStart = (e: React.TouchEvent) => (touchY.current = e.touches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchY.current === null) return;
    const dy = touchY.current - e.touches[0].clientY;
    if (Math.abs(dy) >= 34) {
      turn(Math.sign(dy));
      touchY.current = e.touches[0].clientY;
    }
  };

  const current = items[active];

  return (
    <>
      {/* The always-present half-disc tab on the inline-end edge. */}
      <button
        ref={tabRef}
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={nav.menu}
        className="glass-dark group fixed end-0 top-1/2 z-40 grid h-20 w-6 -translate-y-1/2 place-items-center rounded-s-full border-e-0 opacity-90 transition-[width,opacity] duration-500 ease-(--ease-soft) hover:w-10 hover:opacity-100 sm:h-24 sm:w-8"
      >
        <span className="grid gap-1 ps-1" aria-hidden="true">
          <span className="size-1 rounded-full bg-white/90" />
          <span className="size-1 rounded-full bg-white/60" />
          <span className="size-1 rounded-full bg-white/90" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="dial"
            className="fixed inset-0 z-50"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button type="button" aria-label={nav.close} onClick={() => close()} className="absolute inset-0 bg-[rgb(var(--scrim)/0.32)] backdrop-blur-[3px]" />

            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={nav.menu}
              tabIndex={-1}
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={() => (touchY.current = null)}
              initial={reduce ? false : { x: rtl ? "-40%" : "40%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? undefined : { x: rtl ? "-40%" : "40%", opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="glass-dark absolute end-0 top-1/2 aspect-[1/2] h-[min(92dvh,46rem,188vw)] -translate-y-1/2 touch-none overflow-hidden rounded-s-full border-e-0 outline-none [container-type:size]"
            >
              {/* Concentric guides (owner's picture 5). */}
              <span aria-hidden="true" className="absolute start-[38%] top-1/2 aspect-square h-[124%] -translate-y-1/2 rounded-full border border-white/10" />
              <span aria-hidden="true" className="absolute start-[62%] top-1/2 aspect-square h-[76%] -translate-y-1/2 rounded-full border border-white/10" />

              <nav aria-label={nav.menu} className="absolute inset-0">
                <ul>
                  {items.map((it, i) => {
                    const angle = (i - active) * STEP;
                    const hidden = Math.abs(angle) > VISIBLE;
                    const rad = (angle * Math.PI) / 180;
                    // The pivot is the middle of the inline-end edge; the radius is 50cqh. Labels end on an
                    // inner arc (46 % of the radius) and read outward, towards the rim, so they never leave the disc.
                    const d = Math.cos(rad) * 23;
                    const y = Math.sin(rad) * 30;
                    const isActive = i === active;
                    return (
                      <li
                        key={it.href}
                        aria-hidden={hidden || undefined}
                        className="absolute end-0 top-1/2 w-[25cqh] text-end transition-[transform,opacity] duration-500 ease-(--ease-soft)"
                        style={{
                          transform: `translate(${(rtl ? 1 : -1) * d}cqh, ${y}cqh) translateY(-50%)`,
                          opacity: hidden ? 0 : 1 - Math.abs(angle) / (VISIBLE + 24),
                          pointerEvents: hidden ? "none" : undefined,
                        }}
                      >
                        <Link
                          href={it.href}
                          prefetch
                          tabIndex={hidden ? -1 : 0}
                          onFocus={() => setActive(i)}
                          aria-current={it.href === pathname ? "page" : undefined}
                          className={cn(
                            "inline-flex items-center justify-end gap-2 rounded-full py-1 leading-tight text-balance transition-[color] duration-300",
                            isActive ? "type-display text-[clamp(1.35rem,3.4dvh,2rem)] text-white" : "text-[0.92rem] text-white/70 hover:text-white",
                          )}
                        >
                          {isActive && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[#f6c9d3] shadow-[0_0_12px_#f6c9d3]" />}
                          {it.label}
                        </Link>
                        {isActive && (
                          <p aria-live="polite" className="mt-1 text-[0.8rem] leading-snug text-white/70">
                            {it.short}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Hub at the pivot: opens the page facing the screen. */}
              <button
                type="button"
                onClick={() => router.push(current.href)}
                aria-label={`${nav.dial.open} : ${current.label}`}
                className="absolute end-3 top-1/2 grid size-14 -translate-y-1/2 place-items-center rounded-full bg-[#fffaf8] text-[#25161d] shadow-[inset_0_1px_0_white,0_10px_24px_-8px_rgb(0_0_0/0.6)] transition-transform duration-300 hover:scale-105"
              >
                <svg viewBox="0 0 16 16" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 3 5 8l5 5" />
                </svg>
              </button>

              <div className="absolute inset-x-0 bottom-[7%] flex justify-end gap-2 pe-6 text-xs text-white/60">
                <span>{nav.dial.hint}</span>
              </div>
              <div className="absolute end-5 top-[6%] flex items-center gap-2">
                <Link href={pathname.replace(/^\/(fr|ar)(?=\/|$)/, `/${other}`)} hrefLang={other} lang={other} className="glass-dark-inner rounded-full px-3 py-1.5 text-sm text-white">
                  {localeLabel[other]}
                </Link>
                <button type="button" onClick={() => close()} aria-label={nav.close} className="glass-dark-inner grid size-9 place-items-center rounded-full text-white">
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
