import { Suspense } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { homeArea } from "@/server/policies/roles";
import { signOutAction } from "@/app/[locale]/auth/actions";
import { AccountMenu } from "./account-menu";

/**
 * Header account area. Reads the session cookie, so it streams in behind Suspense;
 * until then (and for visitors) it shows the "Connexion" link.
 */
export const accountPillClass =
  "whitespace-nowrap rounded-full px-3.5 py-2 text-[0.92rem] opacity-90 transition-[opacity,background-color] duration-300 hover:bg-current/10 hover:opacity-100";

export function AccountSlot({
  locale,
  signInLabel,
  variant,
  pillClass = variant === "header" ? accountPillClass : "",
}: {
  locale: Locale;
  signInLabel: string;
  variant: "header" | "mobile";
  pillClass?: string;
}) {
  const signIn = (
    <Link href={`/${locale}/auth/sign-in`} className={pillClass}>
      {signInLabel}
    </Link>
  );
  return (
    <Suspense fallback={signIn}>
      <Account locale={locale} signIn={signIn} pillClass={pillClass} variant={variant} />
    </Suspense>
  );
}

async function Account({ locale, signIn, pillClass, variant }: { locale: Locale; signIn: React.ReactNode; pillClass: string; variant: "header" | "mobile" }) {
  const user = await getSessionUser();
  if (!user) return signIn;
  const t = await getAuthDictionary(locale);
  const dashboardHref = `/${locale}/dashboard/${homeArea(user.role)}`;
  if (variant === "mobile") {
    return (
      <span className="grid gap-3">
        <Link href={dashboardHref}>{t.account.space}</Link>
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit">{t.account.signOut}</button>
        </form>
      </span>
    );
  }
  return <AccountMenu locale={locale} firstName={user.fullName.split(" ")[0]} dashboardHref={dashboardHref} labels={t.account} pillClass={pillClass} />;
}
