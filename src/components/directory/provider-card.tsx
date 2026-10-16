import type { CategorySlug } from "@/config/categories";
import { specialtyLabel } from "@/config/specialties";
import type { Locale } from "@/i18n/config";
import type { PagesDictionary } from "@/i18n/dictionaries/pages.fr";
import { formatDzd } from "@/lib/format";
import type { DirectoryCard } from "@/server/services/directory";
import { SoftCard } from "./soft-card";

export function ProviderCard({
  card,
  category,
  locale,
  copy,
  workplace,
  index = 0,
}: {
  card: DirectoryCard;
  category: CategorySlug;
  locale: Locale;
  copy: PagesDictionary["directory"]["card"];
  workplace: PagesDictionary["workplace"];
  index?: number;
}) {
  const place = [locale === "ar" ? card.communeAr : card.communeFr, locale === "ar" ? card.wilayaAr : card.wilayaFr].filter(Boolean).join(", ");
  const meta = [card.distanceKm !== null ? copy.km(card.distanceKm) : null, workplace[card.workplaceType], card.experienceYears ? copy.years(card.experienceYears) : null]
    .filter(Boolean)
    .join(" • ");
  return (
    <SoftCard
      href={`/${locale}/profiles/${card.slug}`}
      name={card.businessName}
      verified={card.verified}
      verifiedLabel={copy.verified}
      place={place}
      meta={meta}
      headline={card.headline}
      priceLabel={card.startingPrice ? `${copy.from} ${formatDzd(card.startingPrice, locale)}` : null}
      imageUrl={card.imageUrl}
      tags={card.specialties.map((s) => specialtyLabel(category, s, locale))}
      rating={card.rating !== null && card.reviewCount > 0 ? { value: card.rating, label: `${card.rating.toFixed(1)} / 5, ${copy.reviews(card.reviewCount)}` } : null}
      hasVideo={card.hasVideo}
      videoLabel={copy.video}
      bookLabel={copy.book}
      imageFirst={index % 2 === 1}
      priority={index < 2}
    />
  );
}
