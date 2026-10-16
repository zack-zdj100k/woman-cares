import type { CategorySlug } from "./categories";

/**
 * Specialty vocabulary per category. Profiles store the slugs in
 * `ProviderServiceProfile.specialties`; labels are rendered per locale.
 * Phase 10 moves this list into `Category.profileFields` so Admin can edit it.
 */
export type Specialty = { slug: string; fr: string; ar: string };

export const specialtiesByCategory: Record<CategorySlug, Specialty[]> = {
  coiffeuses: [
    { slug: "coupe", fr: "Coupe", ar: "قص" },
    { slug: "brushing", fr: "Brushing", ar: "براشينغ" },
    { slug: "coloration", fr: "Coloration", ar: "صبغ" },
    { slug: "balayage", fr: "Balayage et mèches", ar: "بالاياج وخصلات" },
    { slug: "soins-cheveux", fr: "Soins du cheveu", ar: "علاج الشعر" },
    { slug: "lissage", fr: "Lissage", ar: "تمليس" },
    { slug: "chignon", fr: "Chignon et coiffure de soirée", ar: "تسريحات السهرة" },
    { slug: "mariee", fr: "Coiffure de mariée", ar: "تسريحة العروس" },
  ],
  esthetique: [
    { slug: "soin-visage", fr: "Soin du visage", ar: "علاج الوجه" },
    { slug: "nettoyage-peau", fr: "Nettoyage de peau", ar: "تنظيف البشرة" },
    { slug: "epilation", fr: "Épilation", ar: "إزالة الشعر" },
    { slug: "sourcils", fr: "Sourcils", ar: "الحواجب" },
    { slug: "maquillage", fr: "Maquillage", ar: "مكياج" },
    { slug: "maquillage-mariee", fr: "Maquillage de mariée", ar: "مكياج العروس" },
    { slug: "hammam", fr: "Hammam et gommage", ar: "حمام وتقشير" },
  ],
  massage: [
    { slug: "relaxant", fr: "Massage relaxant", ar: "تدليك للاسترخاء" },
    { slug: "pierres-chaudes", fr: "Pierres chaudes", ar: "الأحجار الساخنة" },
    { slug: "drainage", fr: "Drainage lymphatique", ar: "تصريف لمفاوي" },
    { slug: "prenatal", fr: "Massage prénatal", ar: "تدليك الحامل" },
    { slug: "dos", fr: "Dos et nuque", ar: "الظهر والرقبة" },
    { slug: "reflexologie", fr: "Réflexologie", ar: "علاج انعكاسي" },
  ],
  nails: [
    { slug: "manucure", fr: "Manucure", ar: "مانيكير" },
    { slug: "pedicure", fr: "Pédicure", ar: "باديكير" },
    { slug: "semi-permanent", fr: "Vernis semi-permanent", ar: "طلاء شبه دائم" },
    { slug: "gel", fr: "Pose gel", ar: "جل" },
    { slug: "capsules", fr: "Extensions capsules", ar: "تركيب كبسولات" },
    { slug: "nail-art", fr: "Nail art", ar: "فن الأظافر" },
  ],
  "extensions-de-cils": [
    { slug: "cil-a-cil", fr: "Cil à cil", ar: "رمشة برمشة" },
    { slug: "volume", fr: "Volume russe", ar: "فوليوم روسي" },
    { slug: "mixte", fr: "Mixte", ar: "مختلط" },
    { slug: "rehaussement", fr: "Rehaussement de cils", ar: "رفع الرموش" },
    { slug: "remplissage", fr: "Remplissage", ar: "تعبئة" },
    { slug: "depose", fr: "Dépose", ar: "إزالة" },
  ],
  botox: [
    { slug: "rides-front", fr: "Rides du front", ar: "تجاعيد الجبهة" },
    { slug: "patte-oie", fr: "Pattes d’oie", ar: "تجاعيد حول العين" },
    { slug: "rides-lion", fr: "Ride du lion", ar: "خط العبوس" },
    { slug: "levres", fr: "Lèvres", ar: "الشفاه" },
  ],
};

export function specialtyLabel(category: CategorySlug, slug: string, locale: "fr" | "ar") {
  return specialtiesByCategory[category].find((s) => s.slug === slug)?.[locale] ?? slug;
}
