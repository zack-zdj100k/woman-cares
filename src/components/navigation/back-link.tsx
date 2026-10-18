"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * "Back" that returns to the page the person actually came from (with its tab, filters and page),
 * not to a fixed list. The trail mirrors this tab's in-app history; when the page was opened directly
 * (bookmark, e-mail link, new tab) there is nothing to go back to, so the link's own href is used.
 */
const KEY = "wc:trail";

function readTrail(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Records every in-app page change of this tab. Mounted once in the locale layout. */
export function HistoryTrail() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    const trail = readTrail();
    if (trail.at(-1) === url) return;
    // Arriving on the page before the current one is a step back; anything else is a step forward.
    if (trail.at(-2) === url) trail.pop();
    else trail.push(url);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-50)));
    } catch {}
  }, [pathname, search]);
  return null;
}

export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    // A new tab can inherit the opener's sessionStorage, so the tab's own history must exist too.
    if (readTrail().length < 2 || window.history.length < 2) return;
    e.preventDefault();
    router.back();
  };
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
