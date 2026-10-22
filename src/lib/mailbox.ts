/**
 * The inbox that matches an address, so the "check your e-mail" page can offer a button that opens it.
 * Only the well-known providers; any other address gets no button. Pure and client-safe: the page
 * remembers the provider key (never the address) between sign-up and there.
 *
 * `iosApp` is the provider's own app link. These links are not officially documented and an app that is
 * not installed ignores them, so the page always keeps the web address as the fallback. On Android the
 * providers' https address is what the system hands to their app when it is installed.
 */
export const MAILBOXES = {
  gmail: { url: "https://mail.google.com/", iosApp: "googlegmail://", domains: ["gmail.com", "googlemail.com"] },
  outlook: { url: "https://outlook.live.com/mail/", iosApp: "ms-outlook://", domains: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.fr", "hotmail.fr", "live.fr"] },
  yahoo: { url: "https://mail.yahoo.com/", iosApp: "ymail://mail/", domains: ["yahoo.com", "yahoo.fr", "ymail.com"] },
  icloud: { url: "https://www.icloud.com/mail", iosApp: "message://", domains: ["icloud.com", "me.com", "mac.com"] },
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

export type Platform = "ios" | "android" | "desktop";

/** An iPad asking for the desktop site says "Macintosh": it still has a touch screen. */
export function platformFor(userAgent: string, touchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Macintosh/i.test(userAgent) && touchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}
