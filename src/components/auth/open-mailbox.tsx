"use client";

import { useSyncExternalStore } from "react";
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
 * A button to the visitor's inbox, for the provider she signed up with (nothing for other addresses).
 * On an iPhone it opens the app, with a link to the web version beside it (no automatic fallback: while
 * iOS asks "Open in Gmail?" the page stays visible, and a timer would send this tab away); on Android and computers the web
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
        <a href={mailbox.iosApp} className={buttonClass({ variant: "solid" })}>
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
