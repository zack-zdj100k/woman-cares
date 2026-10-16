import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { publicMediaUrl } from "@/lib/storage/urls";

export type ProfileCard = {
  slug: string;
  businessName: string;
  headline: string;
  categorySlug: string;
  wilayaFr: string;
  wilayaAr: string;
  communeFr: string | null;
  communeAr: string | null;
  startingPrice: string | null;
  imageUrl: string | null;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
};

/**
 * A profile is publicly visible only when: the profile is PUBLISHED, billing has not
 * hidden it, the provider account is APPROVED, its owner is an ACTIVE account with the PROVIDER
 * role (a suspension or role change from the Users page hides it at once), and the category is active.
 * Every public query must go through this filter.
 */
export const publicProfileWhere = {
  status: "PUBLISHED",
  billingVisible: true,
  provider: { status: "APPROVED", user: { status: "ACTIVE", role: "PROVIDER" } },
  category: { active: true },
} as const;

/** Most recently published eligible profiles for the homepage. Cached briefly; tag "profiles". */
export async function getFeaturedProfiles(limit = 8): Promise<ProfileCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles");

  const profiles = await db.providerServiceProfile.findMany({
    where: publicProfileWhere,
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      slug: true,
      headline: true,
      startingPrice: true,
      category: { select: { slug: true } },
      provider: {
        select: {
          businessName: true,
          verifiedAt: true,
          wilaya: { select: { nameFr: true, nameAr: true } },
          commune: { select: { nameFr: true, nameAr: true } },
        },
      },
      media: { where: { isCardImage: true, type: "IMAGE" }, select: { storageKey: true }, take: 1 },
    },
  });

  const ratings = profiles.length
    ? await db.review.groupBy({
        by: ["profileId"],
        where: { profileId: { in: profiles.map((p) => p.id) }, status: "PUBLISHED" },
        _avg: { rating: true },
        _count: { _all: true },
      })
    : [];
  const ratingBy = new Map(ratings.map((r) => [r.profileId, r]));

  return profiles.map((p) => {
    const r = ratingBy.get(p.id);
    return {
      slug: p.slug,
      businessName: p.provider.businessName,
      headline: p.headline,
      categorySlug: p.category.slug,
      wilayaFr: p.provider.wilaya.nameFr,
      wilayaAr: p.provider.wilaya.nameAr,
      communeFr: p.provider.commune?.nameFr ?? null,
      communeAr: p.provider.commune?.nameAr ?? null,
      startingPrice: p.startingPrice?.toString() ?? null,
      imageUrl: p.media[0] ? publicMediaUrl(p.media[0].storageKey) : null,
      verified: p.provider.verifiedAt !== null,
      rating: r?._avg.rating ?? null,
      reviewCount: r?._count._all ?? 0,
    };
  });
}

/** Number of publicly visible profiles per category slug (real counts only). Cached; tag "profiles". */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles");
  const rows = await db.providerServiceProfile.groupBy({ by: ["categoryId"], where: publicProfileWhere, _count: { _all: true } });
  const categories = await db.category.findMany({ select: { id: true, slug: true } });
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));
  return Object.fromEntries(rows.map((r) => [slugById.get(r.categoryId) ?? "", r._count._all]));
}
