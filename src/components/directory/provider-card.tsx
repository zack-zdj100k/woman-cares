import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Star, Video } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { specialtyLabel } from "@/config/specialties";
import type { Locale } from "@/i18n/config";
import type { PagesDictionary } from "@/i18n/dictionaries/pages.fr";
import { formatDzd } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import type { DirectoryCard } from "@/server/services/directory";

export function ProviderCard({
  card,
  category,
  locale,
  copy,
  workplace,
}: {
  card: DirectoryCard;
  category: CategorySlug;
  locale: Locale;
  copy: PagesDictionary["directory"]["card"];
  workplace: PagesDictionary["workplace"];
}) {
  const href = `/${locale}/profiles/${card.slug}`;
  const place = [locale === "ar" ? card.communeAr : card.communeFr, locale === "ar" ? card.wilayaAr : card.wilayaFr]
    .filter(Boolean)
    .join(", ");
  const specialties = card.specialties.slice(0, 3).map((s) => specialtyLabel(category, s, locale));

  return (
    <article className="group flex w-full flex-col">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden rounded-(--radius-media) bg-surface-2" tabIndex={-1} aria-hidden="true">
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 92vw"
            className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.04]"
          />
        )}
        {card.hasVideo && (
          <span className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-[rgb(var(--scrim)/0.45)] text-on-media backdrop-blur-md">
            <Video className="size-4" strokeWidth={1.75} />
            <span className="sr-only">{copy.video}</span>
          </span>
        )}
      </Link>

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-medium leading-snug">
            <Link href={href} className="hover:text-rose-ink">
              {card.businessName}
            </Link>
            {card.verified && (
              <BadgeCheck className="ms-1.5 inline size-4 -translate-y-px text-rose" strokeWidth={1.75} aria-label={copy.verified} />
            )}
          </h3>
          {card.rating !== null && card.reviewCount > 0 && (
            <p className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="size-3.5 fill-current text-rose" strokeWidth={1.5} aria-hidden="true" />
              {card.rating.toFixed(1)}
              <span className="text-ink-2">({copy.reviews(card.reviewCount)})</span>
            </p>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[0.95rem] text-ink-2">{card.headline}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {place}
            {card.distanceKm !== null && ` · ${copy.km(card.distanceKm)}`}
          </span>
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {workplace[card.workplaceType]}
          {card.experienceYears ? `, ${copy.years(card.experienceYears).toLowerCase()}` : ""}
        </p>
        {specialties.length > 0 && <p className="mt-2 text-sm">{specialties.join(", ")}</p>}
        {card.startingPrice && (
          <p className="mt-3 text-[0.95rem]">
            <span className="text-ink-2">{copy.from}</span> <span className="font-medium">{formatDzd(card.startingPrice, locale)}</span>
          </p>
        )}
        <div className="mt-5 grid gap-2 sm:mt-auto sm:pt-5">
          <Link href={`${href}#reserver`} className={buttonClass({ variant: "solid", size: "sm", className: "w-full" })}>
            {copy.request}
          </Link>
          <Link href={href} className={buttonClass({ variant: "outline", size: "sm", className: "w-full" })}>
            {copy.view}
          </Link>
        </div>
      </div>
    </article>
  );
}
