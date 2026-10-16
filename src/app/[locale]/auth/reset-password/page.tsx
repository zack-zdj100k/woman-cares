import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, type AuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { FormAlert } from "@/components/auth/fields";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.reset.metaTitle, robots: { index: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/[locale]/auth/reset-password">) {
  const locale = await getLocale();
  const t = await getAuthDictionary(locale);
  return (
    <PageShell>
      <AuthFrame title={t.reset.title} intro={t.reset.intro}>
        <Suspense fallback={null}>
          <Body searchParams={searchParams} locale={locale} t={t} />
        </Suspense>
      </AuthFrame>
    </PageShell>
  );
}

async function Body({ searchParams, locale, t }: { searchParams: PageProps<"/[locale]/auth/reset-password">["searchParams"]; locale: Locale; t: AuthDictionary }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" && sp.token.length >= 20 && sp.token.length <= 100 ? sp.token : null;
  if (!token) {
    return (
      <FormAlert>
        {t.reset.invalid}{" "}
        <Link href={`/${locale}/auth/forgot-password`} className="underline underline-offset-4">
          {t.reset.requestNew}
        </Link>
      </FormAlert>
    );
  }
  return (
    <ResetPasswordForm
      locale={locale}
      token={token}
      copy={t.reset}
      common={t.common}
      passwordCopy={{ hint: t.signUp.passwordHint, length: t.signUp.errors.length, weak: t.signUp.errors.weak }}
    />
  );
}
