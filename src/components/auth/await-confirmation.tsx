"use client";

import { useEffect, useState } from "react";
import { checkHandoffAction } from "@/app/[locale]/auth/actions";

const EVERY_MS = 4000;
const GIVE_UP_MS = 30 * 60_000;

/**
 * Keeps the "check your e-mail" page listening while she confirms elsewhere (the mail app, another
 * browser). As soon as the address is confirmed, this browser is signed in and opens her space. It asks
 * again the moment she comes back to the tab, and stops after half an hour or when there is nothing to
 * wait for.
 */
export function AwaitConfirmation({ locale, label }: { locale: string; label: string }) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const started = Date.now();

    const check = async () => {
      window.clearTimeout(timer);
      if (stopped || document.hidden) return;
      try {
        const r = await checkHandoffAction(locale);
        if (stopped) return;
        if (r.state === "ready") {
          stopped = true;
          window.location.assign(r.to);
          return;
        }
        if (r.state === "none") {
          stopped = true;
          setWaiting(false);
          return;
        }
        setWaiting(true);
      } catch {
        // A network blip: try again on the next round.
      }
      if (Date.now() - started < GIVE_UP_MS) timer = window.setTimeout(check, EVERY_MS);
    };
    const onVisible = () => {
      if (!document.hidden) void check();
    };

    void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [locale]);

  if (!waiting) return null;
  return (
    <p className="mt-8 flex items-center justify-center gap-2 text-sm text-ink-2" role="status">
      <span className="size-2 animate-pulse rounded-full bg-rose motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </p>
  );
}
