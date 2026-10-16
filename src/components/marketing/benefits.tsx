import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { buttonClass } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { FindCareButton } from "./find-care-button";

export function Benefits({ locale, copy, findLabel }: { locale: Locale; copy: Dictionary["benefits"]; findLabel: string }) {
  return (
    <section aria-label={`${copy.clientsTitle} / ${copy.prosTitle}`} className="mx-auto max-w-[1480px] px-5 pb-24 sm:px-8 md:pb-32 lg:px-14">
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="flex flex-col rounded-(--radius-media) border border-line p-8 md:p-12">
          <h2 className="type-display text-[clamp(2.25rem,4vw,3.5rem)]">{copy.clientsTitle}</h2>
          <ul className="mt-8 grid gap-5">
            {copy.clients.map((item) => (
              <li key={item} className="flex gap-4 text-[1.05rem] leading-relaxed">
                <Check className="mt-1 size-5 shrink-0 text-rose" strokeWidth={1.75} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <FindCareButton label={findLabel} className="mt-10 self-start lg:mt-auto" />
        </Reveal>

        {/* Pros: text sits inside the parchment-lilies frame from the owner's references. */}
        <Reveal
          delay={0.1}
          className="relative overflow-hidden rounded-(--radius-media) bg-[#f3e6d4] bg-[url('/images/backgrounds/parchment-lilies.jpg')] bg-cover bg-center text-media-ink"
        >
          <div className="relative h-full bg-[#f3e6d4]/75 px-8 pt-12 pb-24 sm:px-16 md:bg-[#f3e6d4]/55 md:px-20 md:py-16">
            <h2 className="type-display text-[clamp(2.25rem,4vw,3.5rem)]">{copy.prosTitle}</h2>
            <ul className="mt-8 grid gap-5">
              {copy.pros.map((item) => (
                <li key={item} className="flex gap-4 text-[1.05rem] leading-relaxed">
                  <Check className="mt-1 size-5 shrink-0 text-[#8e3249]" strokeWidth={1.75} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`/${locale}/auth/sign-up?role=provider`}
              className={buttonClass({ variant: "solid", size: "md", className: "mt-10 !bg-[#a8445c] !text-[#fff7f8] hover:!bg-[#8e3249]" })}
            >
              {copy.prosCta}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
