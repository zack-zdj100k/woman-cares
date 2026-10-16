import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { buttonClass } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { InViewVideo } from "./in-view-video";

/** The page's one deliberate color block: wine band that runs into the footer. */
export function ProCta({ locale, copy }: { locale: Locale; copy: Dictionary["proCta"] }) {
  return (
    <section aria-labelledby="pro-cta-title" className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-8 lg:px-12">
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#4a1a2a,#2e1019)] px-6 py-16 text-on-wine shadow-(--shadow-float) sm:px-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:px-14 md:py-20">
        <Reveal>
          <h2 id="pro-cta-title" className="type-display text-[clamp(3rem,7vw,6.5rem)] leading-[1.02]">
            {copy.title}
          </h2>
          <p className="mt-6 max-w-[32rem] text-lg leading-relaxed text-on-wine/80">{copy.body}</p>
          <Link
            href={`/${locale}/auth/sign-up?role=provider`}
            className={buttonClass({ variant: "media", size: "lg", className: "mt-10" })}
          >
            {copy.cta}
            <ArrowUpRight
              className="size-4 transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 rtl:-scale-x-100"
              strokeWidth={1.75}
            />
          </Link>
        </Reveal>
        <Reveal delay={0.1} className="relative mx-auto aspect-[4/5] w-full max-w-[26rem] overflow-hidden rounded-(--radius-media) shadow-[0_40px_100px_-40px_rgb(0_0_0/0.7)]">
          <InViewVideo
            src="/media/pro-cta-nails.mp4"
            poster="/images/hero/pro-cta-nails.jpg"
            className="absolute inset-0 size-full object-cover"
          />
        </Reveal>
      </div>
    </section>
  );
}
