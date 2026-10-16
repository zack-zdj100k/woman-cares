import Link from "next/link";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { buttonClass } from "@/components/ui/button";

export default async function NotFound() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <PageShell>
      <div className="mx-auto max-w-[40rem] px-5 py-32 text-center">
        <h1 className="type-display text-[clamp(2.75rem,6vw,4.5rem)]">{dict.common.notFoundTitle}</h1>
        <p className="mt-4 text-lg text-ink-2">{dict.common.notFoundBody}</p>
        <Link href={`/${locale}`} className={buttonClass({ variant: "solid", className: "mt-10" })}>
          {dict.common.backHome}
        </Link>
      </div>
    </PageShell>
  );
}
