"use client";

import { useSyncExternalStore } from "react";
import { ExternalLink } from "lucide-react";
import { MAILBOXES, MAILBOX_STORAGE_KEY, isMailboxKey, type MailboxKey } from "@/lib/mailbox";
import { buttonClass } from "@/components/ui/button";

const noSubscription = () => () => {};
function remembered() {
  try {
    const value = sessionStorage.getItem(MAILBOX_STORAGE_KEY);
    return isMailboxKey(value) ? value : null;
  } catch {
    return null;
  }
}

/** A button to the visitor's web inbox, for the provider she signed up with (nothing for other addresses). */
export function OpenMailbox({ labels }: { labels: Record<MailboxKey, string> }) {
  const key = useSyncExternalStore(noSubscription, remembered, () => null);
  if (!key) return null;
  return (
    <a href={MAILBOXES[key].url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "solid", className: "mt-8" })}>
      {labels[key]}
      <ExternalLink className="size-4 rtl:-scale-x-100" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
