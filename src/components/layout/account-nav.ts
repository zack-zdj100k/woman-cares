import "server-only";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, getDictionary } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { homeArea } from "@/server/policies/roles";

export type AccountNav = { href: string; label: string };

/**
 * Where the menu's account entry points. Returned as a promise the header hands to the menu, so
 * reading the session never holds up the rest of the page.
 */
export async function accountNavItem(locale: Locale): Promise<AccountNav> {
  const [user, dict] = await Promise.all([getSessionUser(), getDictionary(locale)]);
  if (!user) return { href: `/${locale}/auth/sign-in`, label: dict.nav.signIn };
  const t = await getAuthDictionary(locale);
  return { href: `/${locale}/dashboard/${homeArea(user.role)}`, label: t.account.space };
}
