import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, BadgeCheck, Star } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { getFeaturedProfiles } from "@/server/services/discovery";
import { formatDzd } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Reveal } from "./reveal";

type Props = { locale: Locale; copy: Dictionary["featured"] };

export function FeaturedProfessionals(props: Props) {
  return (
    <section aria-labelledby="featured-title" className="mx-auto max-w-[1480px] px-5 pb-24 sm:px-8 md:pb-32 lg:px-14">
      <h2 id="featured-title" className="type-display mb-12 text-[clamp(2.5rem,5vw,4.5rem)]">
        {props.copy.title}
      </h2>
      <Suspense fallback={<CardsSkeleton />}>
        <FeaturedList {...props} />
      </Suspense>
    </section>
  );
}

async function FeaturedList({ locale, copy }: Props) {
  await connection(); // request-time data: never baked into the static shell
  const profiles = await getFeaturedProfiles();

  if (profiles.length === 0) {
    return (
      <Reveal className="rounded-(--radius-media) bg-parchment px-8 py-14 text-center md:px-14 md:py-20">
        <p className="type-display text-[clamp(2rem,3.5vw,3rem)]">{copy.emptyTitle}</p>
        <p className="mx-auto mt-4 max-w-[36rem] text-lg leading-relaxed text-ink-2">{copy.emptyBody}</p>
        <div className="mt-8 flex flex-col items-center gap-5">
          <a href="#showcase-title" className={buttonClass({ variant: "solid" })}>
            {copy.browse}
          </a>
          <Link
            href={`/${locale}/auth/sign-up?role=provider`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-2 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-rose-ink hover:decoration-rose"
          >
            {copy.proLink}
            <ArrowUpRight className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          </Link>
        </div>
      </Reveal>
    );
  }

  return (
    <ul className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14 [scrollbar-width:thin]">
      {profiles.map((p) => (
        <li key={p.slug} className="w-[min(20rem,78vw)] shrink-0 snap-start">
          <Link href={`/${locale}/profiles/${p.slug}`} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-(--radius-media) bg-surface-2">
              {p.imageUrl && (
                <Image
                  src={p.imageUrl}
                  alt=""
                  fill
                  sizes="20rem"
                  className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.05]"
                />
              )}
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-lg font-medium">
                  {p.businessName}
                  {p.verified && <BadgeCheck className="size-4 text-rose" strokeWidth={1.75} aria-label="Vérifiée" />}
                </p>
                <p className="text-sm text-ink-2">
                  {[locale === "ar" ? p.communeAr : p.communeFr, locale === "ar" ? p.wilayaAr : p.wilayaFr]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              {p.rating !== null && p.reviewCount > 0 && (
                <p className="flex items-center gap-1 text-sm">
                  <Star className="size-3.5 fill-current text-rose" strokeWidth={1.5} />
                  {p.rating.toFixed(1)} ({p.reviewCount})
                </p>
              )}
            </div>
            {p.startingPrice && (
              <p className="mt-2 text-sm text-ink-2">
                {copy.from} {formatDzd(p.startingPrice, locale)}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CardsSkeleton() {
  return (
    <div className="flex gap-5 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-[min(20rem,78vw)] shrink-0">
          <div className="aspect-[4/5] animate-pulse rounded-(--radius-media) bg-surface-2" />
          <div className="mt-4 h-4 w-2/3 animate-pulse rounded-full bg-surface-2" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
