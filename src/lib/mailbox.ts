/**
 * The web inbox that matches an address, so the "check your e-mail" page can offer a button that
 * opens it. Only the well-known providers; any other address simply gets no button. Pure and
 * client-safe: the page remembers the provider key (never the address) between sign-up and there.
 */
export const MAILBOXES = {
  gmail: { url: "https://mail.google.com/", domains: ["gmail.com", "googlemail.com"] },
  outlook: { url: "https://outlook.live.com/mail/", domains: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.fr", "hotmail.fr", "live.fr"] },
  yahoo: { url: "https://mail.yahoo.com/", domains: ["yahoo.com", "yahoo.fr", "ymail.com"] },
  icloud: { url: "https://www.icloud.com/mail", domains: ["icloud.com", "me.com", "mac.com"] },
} as const;

export type MailboxKey = keyof typeof MAILBOXES;

export function mailboxKeyFor(email: string): MailboxKey | null {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  for (const key of Object.keys(MAILBOXES) as MailboxKey[]) {
    if ((MAILBOXES[key].domains as readonly string[]).includes(domain)) return key;
  }
  return null;
}

export function isMailboxKey(value: unknown): value is MailboxKey {
  return typeof value === "string" && Object.hasOwn(MAILBOXES, value);
}

export const MAILBOX_STORAGE_KEY = "wc:mailbox";
