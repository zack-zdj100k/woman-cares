import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getAuthDictionary, getDictionary, getPagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignUpForm } from "@/components/auth/auth-forms";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.signUp.metaTitle };
}

export default async function SignUpPage({ searchParams }: PageProps<"/[locale]/auth/sign-up">) {
  const locale = await getLocale();
  return (
    <PageShell>
      <Suspense fallback={<div className="mx-auto h-[40rem] max-w-[1480px]" aria-hidden="true" />}>
        <SignUp searchParams={searchParams} locale={locale} />
      </Suspense>
    </PageShell>
  );
}

async function SignUp({ searchParams, locale }: { searchParams: PageProps<"/[locale]/auth/sign-up">["searchParams"]; locale: Locale }) {
  const sp = await searchParams;
  const role = sp.role === "provider" ? "provider" : "client";
  const [t, dict, pages] = await Promise.all([getAuthDictionary(locale), getDictionary(locale), getPagesDictionary(locale)]);
  const categoryNames = Object.fromEntries(categorySlugs.map((s) => [s, dict.categories[s].name])) as Record<CategorySlug, string>;
  const tab = (active: boolean) =>
    cn("rounded-full px-5 py-2.5 text-sm font-medium transition-colors", active ? "bg-ink text-ground" : "text-ink-2 hover:text-ink");

  return (
    <AuthFrame
      title={role === "provider" ? t.signUp.providerTitle : t.signUp.clientTitle}
      intro={role === "provider" ? t.signUp.providerIntro : t.signUp.clientIntro}
      image={role === "provider" ? "/images/hero/pro-cta-nails.jpg" : "/images/hero/chapter-10.jpg"}
      imagePosition={role === "provider" ? "50% 50%" : "60% 50%"}
      footer={
        <>
          {t.signUp.haveAccount}{" "}
          <Link href={`/${locale}/auth/sign-in`} className="font-medium text-rose-ink underline-offset-4 hover:underline">
            {t.signUp.signIn}
          </Link>
        </>
      }
    >
      <nav aria-label={t.signUp.metaTitle} className="mb-8 inline-flex rounded-full border border-line p-1">
        <Link href={`/${locale}/auth/sign-up`} aria-current={role === "client" ? "page" : undefined} className={tab(role === "client")}>
          {t.signUp.clientTab}
        </Link>
        <Link href={`/${locale}/auth/sign-up?role=provider`} aria-current={role === "provider" ? "page" : undefined} className={tab(role === "provider")}>
          {t.signUp.providerTab}
        </Link>
      </nav>
      <SignUpForm key={role} locale={locale} role={role} copy={t.signUp} common={t.common} categoryNames={categoryNames} workplaceLabels={pages.workplace} />
    </AuthFrame>
  );
}
