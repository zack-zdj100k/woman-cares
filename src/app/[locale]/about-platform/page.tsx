import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDictionary, getPagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { FindCareButton } from "@/components/marketing/find-care-button";
import { Reveal } from "@/components/marketing/reveal";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPagesDictionary(await getLocale());
  return { title: pages.aboutPlatform.metaTitle, description: pages.aboutPlatform.intro };
}

export default async function AboutPlatformPage() {
  const locale = await getLocale();
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  const a = pages.aboutPlatform;

  return (
    <PageShell>
      <header className="mx-auto max-w-[1480px] px-5 pt-12 sm:px-8 md:pt-20 lg:px-14">
        <h1 className="type-display max-w-[60rem] text-[clamp(2.75rem,6vw,5.75rem)]">{a.title}</h1>
        <p className="mt-6 max-w-[44rem] text-xl leading-relaxed text-ink-2">{a.intro}</p>
      </header>

      {/* Two film stills side by side: the salon and the treatment room. */}
      <div className="mx-auto mt-14 grid max-w-[1480px] grid-cols-[3fr_2fr] gap-4 px-5 sm:px-8 md:mt-20 lg:px-14">
        <div className="relative aspect-[16/11] overflow-hidden rounded-(--radius-media)">
          <Image src="/images/hero/chapter-3.jpg" alt="" fill loading="eager" fetchPriority="high" sizes="60vw" className="object-cover" />
        </div>
        <div className="relative overflow-hidden rounded-(--radius-media)">
          <Image src="/images/hero/chapter-10.jpg" alt="" fill sizes="40vw" className="object-cover object-[65%_50%]" />
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] px-5 py-20 sm:px-8 md:py-28 lg:px-14">
        <ol className="divide-y divide-line border-y border-line">
          {a.sections.map((s) => (
            <Reveal as="li" key={s.title} className="grid gap-4 py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 md:py-14">
              <h2 className="type-display text-[clamp(2rem,3.2vw,3rem)]">{s.title}</h2>
              <p className="max-w-[40rem] text-lg leading-relaxed text-ink-2 md:pt-2">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>

      <section className="bg-surface">
        <div className="mx-auto flex max-w-[1480px] flex-col items-start gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center md:justify-between md:py-24 lg:px-14">
          <p lang="en" dir="ltr" className="font-[family-name:var(--font-cormorant)] text-[clamp(2.25rem,4vw,3.5rem)] leading-tight italic">
            {dict.brand.signature}
          </p>
          <div className="flex flex-wrap gap-3">
            <FindCareButton label={a.ctaClient} variant="solid" />
            <Link href={`/${locale}/about-services`} className={buttonClass({ variant: "outline" })}>
              {a.ctaPro}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
