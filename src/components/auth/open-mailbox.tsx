"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { ExternalLink } from "lucide-react";
import { MAILBOXES, MAILBOX_STORAGE_KEY, isMailboxKey, platformFor, type MailboxKey, type Platform } from "@/lib/mailbox";
import { buttonClass } from "@/components/ui/button";

type Labels = { open: Record<MailboxKey, string>; app: Record<MailboxKey, string>; web: Record<MailboxKey, string> };

const noSubscription = () => () => {};
function rememberedKey() {
  try {
    const value = sessionStorage.getItem(MAILBOX_STORAGE_KEY);
    return isMailboxKey(value) ? value : null;
  } catch {
    return null;
  }
}
function currentPlatform(): Platform {
  return platformFor(navigator.userAgent, navigator.maxTouchPoints);
}

/**
 * Tries the provider's app, and falls back to its web address if the app did not take over (the page
 * stays visible) after a moment. Opening the app moves the page to the background, which cancels it.
 */
function openApp(event: MouseEvent<HTMLAnchorElement>, scheme: string, webUrl: string) {
  event.preventDefault();
  const fallback = window.setTimeout(() => {
    window.location.href = webUrl;
  }, 1500);
  const cancel = () => window.clearTimeout(fallback);
  document.addEventListener("visibilitychange", () => document.hidden && cancel(), { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  window.location.href = scheme;
}

/**
 * A button to the visitor's inbox, for the provider she signed up with (nothing for other addresses).
 * On an iPhone it opens the app and keeps a link to the web version; on Android and computers the web
 * address is the button, which Android hands to the provider's app when it is installed.
 */
export function OpenMailbox({ labels }: { labels: Labels }) {
  const key = useSyncExternalStore(noSubscription, rememberedKey, () => null);
  const platform = useSyncExternalStore(noSubscription, currentPlatform, (): Platform => "desktop");
  if (!key) return null;
  const mailbox = MAILBOXES[key];

  if (platform === "ios") {
    return (
      <div className="mt-8 grid justify-items-center gap-3">
        <a href={mailbox.iosApp} onClick={(e) => openApp(e, mailbox.iosApp, mailbox.url)} className={buttonClass({ variant: "solid" })}>
          {labels.app[key]}
          <ExternalLink className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden="true" />
        </a>
        <a href={mailbox.url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink-2 underline underline-offset-4">
          {labels.web[key]}
        </a>
      </div>
    );
  }
  return (
    <a href={mailbox.url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "solid", className: "mt-8" })}>
      {labels.open[key]}
      <ExternalLink className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
