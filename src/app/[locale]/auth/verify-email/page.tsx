import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, type AuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { FormAlert } from "@/components/auth/fields";
import { buttonClass } from "@/components/ui/button";
import { AutoConfirmForm } from "@/components/auth/auto-confirm-form";
import { verifyEmailAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.verify.metaTitle, robots: { index: false }, referrer: "no-referrer" };
}

export default async function VerifyEmailPage({ searchParams }: PageProps<"/[locale]/auth/verify-email">) {
  const locale = await getLocale();
  const t = await getAuthDictionary(locale);
  return (
    <PageShell>
      <div className="mx-auto max-w-[36rem] px-5 py-24 text-center">
        <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{t.verify.title}</h1>
        <Suspense fallback={null}>
          <Body searchParams={searchParams} locale={locale} t={t} />
        </Suspense>
      </div>
    </PageShell>
  );
}

async function Body({ searchParams, locale, t }: { searchParams: PageProps<"/[locale]/auth/verify-email">["searchParams"]; locale: Locale; t: AuthDictionary }) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : null;
  const token = typeof sp.token === "string" ? sp.token : null;

  if (status === "ok") {
    return (
      <div className="mt-8 grid justify-items-center gap-8">
        <FormAlert tone="info">{t.verify.ok}</FormAlert>
        <Link href={`/${locale}/auth/sign-in?notice=verified`} className={buttonClass({ variant: "solid" })}>
          {t.verify.continue}
        </Link>
      </div>
    );
  }
  if (status === "invalid" || status === "expired") {
    return (
      <div className="mt-8 grid justify-items-center gap-8">
        <FormAlert>{status === "expired" ? t.verify.expired : t.verify.invalid}</FormAlert>
        <Link href={`/${locale}/auth/sign-in`} className={buttonClass({ variant: "outline" })}>
          {t.verify.continue}
        </Link>
      </div>
    );
  }
  if (!token) return <p className="mt-6 text-lg text-ink-2">{t.verify.missing}</p>;
  return (
    <AutoConfirmForm action={verifyEmailAction} className="mt-6 grid justify-items-center gap-8">
      <p className="text-lg leading-relaxed text-ink-2">{t.verify.body}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <button type="submit" className={buttonClass({ variant: "solid", size: "lg" })}>
        {t.verify.submit}
      </button>
    </AutoConfirmForm>
  );
}
