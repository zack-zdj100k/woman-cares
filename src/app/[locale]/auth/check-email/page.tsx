import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { getAuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAuthDictionary(await getLocale());
  return { title: t.checkEmail.metaTitle, robots: { index: false } };
}

export default async function CheckEmailPage() {
  const locale = await getLocale();
  const t = await getAuthDictionary(locale);
  return (
    <PageShell>
      <div className="mx-auto max-w-[36rem] px-5 py-24 text-center">
        <MailCheck className="mx-auto size-10 text-rose" strokeWidth={1.25} aria-hidden="true" />
        <h1 className="type-display mt-6 text-[clamp(2.6rem,5vw,4rem)]">{t.checkEmail.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-2">{t.checkEmail.body}</p>
        <p className="mt-3 text-ink-2">{t.checkEmail.spam}</p>
        <Link href={`/${locale}/auth/sign-in`} className={buttonClass({ variant: "outline", className: "mt-10" })}>
          {t.checkEmail.signIn}
        </Link>
      </div>
    </PageShell>
  );
}
