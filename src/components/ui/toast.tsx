"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";

const EVENT = "wc:toast";
const noSubscription = () => () => {};

/**
 * A short success message at the bottom of the screen. It lives in the dashboard shell, not in the form
 * that sent it, because a decision often removes its own button (the stopped trial no longer shows
 * "Arrêter"), and the message must survive the refresh that follows.
 */
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

/** `theme` is the class that sets the colours where it is shown (the dashboards are dark). */
export function Toaster({ theme = "dashboard-dark" }: { theme?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  // True only in the browser (document.body exists), without an extra render.
  const mounted = useSyncExternalStore(noSubscription, () => true, () => false);
  useEffect(() => {
    let timer: number | undefined;
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 6000);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);
  // In <body>, so no parent's layout can move it off screen.
  if (!mounted) return null;
  return createPortal(
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      {message && (
        <div className={`${theme} pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl border border-success/40 [background:var(--card)] px-4 py-3 text-sm text-card-foreground shadow-[0_18px_40px_-16px_rgb(0_0_0/0.7)] motion-safe:animate-[dialog-in_220ms_ease-out]`}>
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden="true" />
          <span className="leading-relaxed">{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="-me-1 ms-1 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="OK">
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
