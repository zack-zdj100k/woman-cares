import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getAuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth/redirects";
import { PageShell } from "@/components/layout/page-shell";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignInForm } from "@/components/auth/auth-forms";
import { AccountSwitch } from "@/components/auth/account-switch";
import { FormAlert } from "@/components/auth/fields";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.signIn.metaTitle, robots: { index: false } };
}

export default async function SignInPage({ searchParams }: PageProps<"/[locale]/auth/sign-in">) {
  const locale = await getLocale();
  const t = await getAuthDictionary(locale);
  return (
    <PageShell>
      <AuthFrame
        title={t.signIn.title}
        intro={t.signIn.intro}
        image="/images/auth/sign-in-nails.webp"
        imagePosition="50% 45%"
        top={<AccountSwitch locale={locale} labels={{ signIn: t.signIn.existingAccount, create: t.signIn.createAccount }} />}
        footer={
          <>
            {t.signIn.noAccount}{" "}
            <Link href={`/${locale}/auth/sign-up`} className="font-medium text-rose-ink underline-offset-4 hover:underline">
              {t.signIn.createAccount}
            </Link>
          </>
        }
      >
        <div className="grid gap-5">
          <Suspense fallback={null}>
            <Notice searchParams={searchParams} t={t} />
          </Suspense>
          <SignInForm
            locale={locale}
            copy={t.signIn}
            common={t.common}
            nextSlot={
              <Suspense fallback={null}>
                <NextInput searchParams={searchParams} locale={locale} />
              </Suspense>
            }
          />
        </div>
      </AuthFrame>
    </PageShell>
  );
}

type SP = PageProps<"/[locale]/auth/sign-in">["searchParams"];

/** Hidden return path, validated against open redirects. */
async function NextInput({ searchParams, locale }: { searchParams: SP; locale: Locale }) {
  const sp = await searchParams;
  const next = safeNextPath(Array.isArray(sp.next) ? sp.next[0] : sp.next, locale);
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

async function Notice({ searchParams, t }: { searchParams: SP; t: Awaited<ReturnType<typeof getAuthDictionary>> }) {
  const sp = await searchParams;
  const notice = typeof sp.notice === "string" && sp.notice in t.signIn.notices ? t.signIn.notices[sp.notice as keyof typeof t.signIn.notices] : null;
  return notice ? <FormAlert tone="info">{notice}</FormAlert> : null;
}
