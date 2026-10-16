import type { Metadata } from "next";
import Link from "next/link";
import { getAuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.forgot.metaTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = await getAuthDictionary(locale);
  return (
    <PageShell>
      <AuthFrame
        title={t.forgot.title}
        intro={t.forgot.intro}
        footer={
          <Link href={`/${locale}/auth/sign-in`} className="font-medium text-rose-ink underline-offset-4 hover:underline">
            {t.forgot.back}
          </Link>
        }
      >
        <ForgotPasswordForm locale={locale} copy={t.forgot} common={t.common} />
      </AuthFrame>
    </PageShell>
  );
}
