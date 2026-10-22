"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The confirmation form, submitted by the page itself a moment after it opens, so a click on the e-mail
 * link is all it takes. It stays a POST, and it is not submitted for automated browsers: a mail scanner
 * that opens the link would otherwise use up the one-time token before she does. The button remains as
 * the manual way (and for browsers without scripts).
 */
export function AutoConfirmForm({ action, className, children }: { action: (form: FormData) => void | Promise<void>; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (navigator.webdriver) return;
    const timer = window.setTimeout(() => ref.current?.requestSubmit(), 700);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <form ref={ref} action={action} className={className}>
      {children}
    </form>
  );
}
