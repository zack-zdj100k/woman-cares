import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { Reveal } from "./reveal";

/** Brand signature set inside the owner's rose filigree frame, beside the founding idea. */
export function Manifesto({
  locale,
  brand,
  copy,
}: {
  locale: Locale;
  brand: Dictionary["brand"];
  copy: Dictionary["manifesto"];
}) {
  return (
    <section aria-label={brand.signature} className="bg-surface">
      <div className="mx-auto grid max-w-[1480px] items-center gap-12 px-5 py-24 sm:px-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:py-32 lg:px-14">
        <Reveal className="relative mx-auto aspect-[9/16] w-full max-w-[22rem] overflow-hidden rounded-(--radius-media) shadow-[0_40px_90px_-40px_rgb(120_50_70/0.45)]">
          <Image
            src="/images/backgrounds/rose-filigree.jpg"
            alt=""
            fill
            sizes="(min-width: 768px) 22rem, 90vw"
            className="object-cover"
          />
          <div className="absolute inset-x-10 top-[24%] grid gap-4 text-center text-media-ink">
            <p lang="en" dir="ltr" className="font-[family-name:var(--font-cormorant)] text-[2.1rem] leading-[1.1] italic">
              {brand.signature}
            </p>
            <span className="mx-auto h-px w-10 bg-media-ink/30" />
            <p className="text-sm text-media-ink/75">{brand.signatureTranslated}</p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="type-display text-[clamp(1.9rem,3.4vw,3.2rem)] leading-[1.15] text-ink">{copy.body}</p>
          <Link
            href={`/${locale}/about-platform`}
            className="group mt-10 inline-flex items-center gap-2 border-b border-ink/30 pb-1 text-base transition-colors hover:border-rose hover:text-rose-ink"
          >
            {copy.about}
            <ArrowUpRight
              className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
              strokeWidth={1.75}
            />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
