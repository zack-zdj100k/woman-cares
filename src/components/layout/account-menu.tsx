"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { signOutAction } from "@/app/[locale]/auth/actions";
import { cn } from "@/lib/cn";

type Props = {
  locale: string;
  firstName: string;
  dashboardHref: string;
  /** Profile picture, shown in the circle instead of the name. */
  avatarUrl?: string | null;
  /** Account settings page (name, language, password). */
  settings?: { href: string; label: string };
  labels: { menu: string; space: string; signOut: string };
  pillClass: string;
};

/** Signed-in header control: a pill with the first name and a small menu. */
export function AccountMenu({ locale, firstName, dashboardHref, settings, avatarUrl, labels, pillClass }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" aria-label={labels.menu} onClick={() => setOpen((o) => !o)} className={cn(pillClass, "inline-flex items-center gap-2")}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
        ) : (
          <>
            <UserRound className="size-4" strokeWidth={1.75} />
            <span className="max-w-[8rem] truncate">{firstName}</span>
          </>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute end-0 top-[calc(100%+0.6rem)] z-10 w-56 rounded-[18px] border border-line bg-ground p-1.5 text-ink shadow-[0_24px_60px_-24px_rgb(37_22_29/0.45)]"
          >
            <Link role="menuitem" href={dashboardHref} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-[0.95rem] hover:bg-surface">
              {labels.space}
            </Link>
            {settings && (
              <Link role="menuitem" href={settings.href} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-4 py-3 text-[0.95rem] hover:bg-surface">
                <Settings className="size-4" strokeWidth={1.75} />
                {settings.label}
              </Link>
            )}
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button role="menuitem" type="submit" className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-start text-[0.95rem] hover:bg-surface">
                <LogOut className="size-4" strokeWidth={1.75} />
                {labels.signOut}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
