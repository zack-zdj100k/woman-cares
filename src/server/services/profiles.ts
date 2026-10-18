import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { publicMediaUrl } from "@/lib/storage/urls";
import { publicProfileWhere } from "./discovery";

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/**
 * Everything a visitor may see on a category profile. Never includes the street address,
 * coordinates, credentials or private media. Returns null when the profile is not public.
 */
export async function getPublicProfile(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles", `profile:${slug}`);

  const p = await db.providerServiceProfile.findFirst({
    where: { slug, ...publicProfileWhere },
    select: {
      id: true,
      slug: true,
      headline: true,
      description: true,
      experienceYears: true,
      startingPrice: true,
      specialties: true,
      hygieneNotes: true,
      productNotes: true,
      cancellationPolicy: true,
      socialLinks: true,
      category: { select: { slug: true, requiresCredentialReview: true } },
      provider: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          bio: true,
          workplaceType: true,
          publicPhone: true,
          whatsapp: true,
          publicEmail: true,
          mapsUrl: true,
          verifiedAt: true,
          wilaya: { select: { nameFr: true, nameAr: true } },
          commune: { select: { nameFr: true, nameAr: true } },
          profiles: {
            where: { ...publicProfileWhere, slug: { not: slug } },
            select: { slug: true, category: { select: { slug: true } } },
          },
        },
      },
      services: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, description: true, durationMinutes: true, priceMin: true, priceMax: true },
      },
      media: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        select: { id: true, type: true, storageKey: true, altText: true, width: true, height: true, isCover: true },
        take: 24,
      },
      schedules: {
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
        select: { weekday: true, startMinute: true, endMinute: true },
      },
    },
  });
  if (!p) return null;

  const [ratingAgg, reviews] = await Promise.all([
    db.review.aggregate({
      where: { profileId: p.id, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.review.findMany({
      where: { profileId: p.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, rating: true, comment: true, createdAt: true, client: { select: { fullName: true } } },
    }),
  ]);

  return {
    slug: p.slug,
    categorySlug: p.category.slug,
    regulated: p.category.requiresCredentialReview,
    headline: p.headline,
    description: p.description,
    experienceYears: p.experienceYears,
    startingPrice: p.startingPrice?.toString() ?? null,
    specialties: p.specialties,
    hygieneNotes: p.hygieneNotes,
    productNotes: p.productNotes,
    cancellationPolicy: p.cancellationPolicy,
    socialLinks: sanitizeSocialLinks(p.socialLinks),
    provider: {
      slug: p.provider.slug,
      businessName: p.provider.businessName,
      bio: p.provider.bio,
      workplaceType: p.provider.workplaceType,
      publicPhone: p.provider.publicPhone,
      whatsapp: p.provider.whatsapp,
      publicEmail: p.provider.publicEmail,
      mapsUrl: p.provider.mapsUrl,
      verified: p.provider.verifiedAt !== null,
      wilayaFr: p.provider.wilaya.nameFr,
      wilayaAr: p.provider.wilaya.nameAr,
      communeFr: p.provider.commune?.nameFr ?? null,
      communeAr: p.provider.commune?.nameAr ?? null,
      otherProfiles: p.provider.profiles.map((o) => ({ slug: o.slug, categorySlug: o.category.slug })),
    },
    services: p.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceMin: s.priceMin.toString(),
      priceMax: s.priceMax?.toString() ?? null,
    })),
    media: p.media.map((m) => ({
      id: m.id,
      type: m.type,
      url: publicMediaUrl(m.storageKey),
      alt: m.altText,
      width: m.width,
      height: m.height,
    })),
    schedules: p.schedules,
    rating: ratingAgg._avg.rating,
    reviewCount: ratingAgg._count._all,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      // First name and initial only.
      author: shortName(r.client.fullName),
    })),
  };
}

export function shortName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

const SOCIAL_HOSTS: Record<string, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
};

/** Keeps only https links to known social hosts, so a profile can never link to arbitrary sites. */
export function sanitizeSocialLinks(value: unknown): { network: string; url: string }[] {
  if (!value || typeof value !== "object") return [];
  const out: { network: string; url: string }[] = [];
  for (const [network, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "string" || !(network in SOCIAL_HOSTS)) continue;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && SOCIAL_HOSTS[network].includes(url.hostname)) out.push({ network, url: url.toString() });
    } catch {
      // ignore malformed links
    }
  }
  return out;
}

/** Public identity page: business info and its published category profiles. */
export async function getPublicProvider(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles", `provider:${slug}`);

  const a = await db.providerAccount.findFirst({
    where: { slug, status: "APPROVED", user: { status: "ACTIVE", role: "PROVIDER" } },
    select: {
      slug: true,
      businessName: true,
      bio: true,
      workplaceType: true,
      verifiedAt: true,
      wilaya: { select: { nameFr: true, nameAr: true } },
      commune: { select: { nameFr: true, nameAr: true } },
      profiles: {
        where: publicProfileWhere,
        orderBy: { category: { sortOrder: "asc" } },
        select: {
          slug: true,
          headline: true,
          startingPrice: true,
          category: { select: { slug: true } },
          media: {
            where: { type: "IMAGE" },
            orderBy: [{ isCardImage: "desc" }, { sortOrder: "asc" }],
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
  });
  if (!a || a.profiles.length === 0) return null;
  return {
    slug: a.slug,
    businessName: a.businessName,
    bio: a.bio,
    workplaceType: a.workplaceType,
    verified: a.verifiedAt !== null,
    wilayaFr: a.wilaya.nameFr,
    wilayaAr: a.wilaya.nameAr,
    communeFr: a.commune?.nameFr ?? null,
    communeAr: a.commune?.nameAr ?? null,
    profiles: a.profiles.map((p) => ({
      slug: p.slug,
      headline: p.headline,
      categorySlug: p.category.slug,
      startingPrice: p.startingPrice?.toString() ?? null,
      imageUrl: p.media[0] ? publicMediaUrl(p.media[0].storageKey) : null,
    })),
  };
}
