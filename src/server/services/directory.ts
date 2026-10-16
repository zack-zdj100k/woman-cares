import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { publicMediaUrl } from "@/lib/storage/urls";
import { PAGE_SIZE, type DirectoryQuery } from "@/lib/validation/directory";

export type DirectoryCard = {
  slug: string;
  providerSlug: string;
  businessName: string;
  headline: string;
  specialties: string[];
  startingPrice: string | null;
  experienceYears: number | null;
  wilayaFr: string;
  wilayaAr: string;
  communeFr: string | null;
  communeAr: string | null;
  workplaceType: "SALON" | "STUDIO" | "HOME" | "MOBILE";
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  imageUrl: string | null;
  hasVideo: boolean;
  distanceKm: number | null;
};

export type DirectoryResult = { cards: DirectoryCard[]; total: number; page: number; pageCount: number };

type Row = {
  slug: string;
  providerSlug: string;
  businessName: string;
  headline: string;
  specialties: string[];
  startingPrice: Prisma.Decimal | null;
  experienceYears: number | null;
  wilayaFr: string;
  wilayaAr: string;
  communeFr: string | null;
  communeAr: string | null;
  workplaceType: DirectoryCard["workplaceType"];
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  imageKey: string | null;
  hasVideo: boolean;
  distanceKm: number | null;
  total: bigint;
};

/** Escapes LIKE wildcards in user text and wraps it for a contains match. */
export function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD date; the date is a calendar day in Africa/Algiers. */
export function weekdayOf(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/**
 * Public directory search. Visibility rules (published profile, billing-visible,
 * approved provider whose own account is active, active category) are fixed in SQL and cannot be relaxed by the query.
 *
 * Distance uses the provider's *public* position: exact coordinates only when the provider
 * chose EXACT; otherwise the commune centroid (or coordinates rounded to ~1 km).
 */
export async function searchDirectory(category: string, query: DirectoryQuery): Promise<DirectoryResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("profiles", `directory:${category}`);

  const page = query.page ?? 1;
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.status = 'PUBLISHED'`,
    Prisma.sql`p."billingVisible" = true`,
    Prisma.sql`a.status = 'APPROVED'`,
    Prisma.sql`u.status = 'ACTIVE'`,
    Prisma.sql`u.role = 'PROVIDER'`,
    Prisma.sql`cat.active = true`,
    Prisma.sql`cat.slug = ${category}`,
  ];

  if (query.wilaya) conditions.push(Prisma.sql`a."wilayaCode" = ${query.wilaya}`);
  if (query.commune) {
    const like = likePattern(query.commune);
    conditions.push(Prisma.sql`(c."nameFr" ILIKE ${like} OR c."nameAr" ILIKE ${like})`);
  }
  if (query.q) {
    const like = likePattern(query.q);
    conditions.push(Prisma.sql`(
      p.headline ILIKE ${like} OR p.description ILIKE ${like} OR a."businessName" ILIKE ${like}
      OR array_to_string(p.specialties, ' ') ILIKE ${like}
      OR EXISTS (SELECT 1 FROM "ProviderService" s WHERE s."profileId" = p.id AND s.active AND s.name ILIKE ${like})
    )`);
  }
  if (query.minPrice !== undefined) conditions.push(Prisma.sql`p."startingPrice" >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) conditions.push(Prisma.sql`p."startingPrice" <= ${query.maxPrice}`);
  if (query.minExperience !== undefined) conditions.push(Prisma.sql`p."experienceYears" >= ${query.minExperience}`);
  if (query.verified) conditions.push(Prisma.sql`a."verifiedAt" IS NOT NULL`);
  if (query.specialty) conditions.push(Prisma.sql`${query.specialty} = ANY(p.specialties)`);
  if (query.minRating !== undefined) conditions.push(Prisma.sql`r.avg >= ${query.minRating}`);
  if (query.date) {
    // "Open that day": has weekly hours on that weekday and no closure exception on that date.
    // Slot-level availability arrives with the booking engine (Phase 6).
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "WorkingSchedule" ws WHERE ws."profileId" = p.id AND ws.weekday = ${weekdayOf(query.date)})`);
    conditions.push(
      Prisma.sql`NOT EXISTS (SELECT 1 FROM "ScheduleException" se WHERE se."profileId" = p.id AND se.date = ${query.date}::date AND se."isClosed")`,
    );
  }

  const hasCoords = query.lat !== undefined && query.lng !== undefined;
  const distanceExpr = hasCoords
    ? Prisma.sql`CASE WHEN b.lat IS NULL THEN NULL ELSE
        6371 * 2 * asin(sqrt(
          power(sin(radians(b.lat - ${query.lat}::float8) / 2), 2) +
          cos(radians(${query.lat}::float8)) * cos(radians(b.lat)) * power(sin(radians(b.lng - ${query.lng}::float8) / 2), 2)
        )) END`
    : Prisma.sql`NULL::float8`;

  const distanceFilter =
    hasCoords && query.maxKm ? Prisma.sql`WHERE d."distanceKm" <= ${query.maxKm}` : Prisma.empty;

  const orderBy = (() => {
    switch (query.sort) {
      case "distance":
        return Prisma.sql`d."distanceKm" ASC NULLS LAST, d."publishedAt" DESC`;
      case "price":
        return Prisma.sql`d."startingPrice" ASC NULLS LAST, d."publishedAt" DESC`;
      case "price_desc":
        return Prisma.sql`d."startingPrice" DESC NULLS LAST, d."publishedAt" DESC`;
      case "rating":
        return Prisma.sql`d.rating DESC NULLS LAST, d."reviewCount" DESC, d."publishedAt" DESC`;
      default:
        return Prisma.sql`d.verified DESC, d."reviewCount" DESC, d."publishedAt" DESC`;
    }
  })();

  const rows = await db.$queryRaw<Row[]>`
    WITH b AS (
      SELECT
        p.slug, a.slug AS "providerSlug", a."businessName", p.headline, p.specialties, p."startingPrice",
        p."experienceYears", p."publishedAt", a."workplaceType",
        w."nameFr" AS "wilayaFr", w."nameAr" AS "wilayaAr", c."nameFr" AS "communeFr", c."nameAr" AS "communeAr",
        (a."verifiedAt" IS NOT NULL) AS verified,
        r.avg AS rating, COALESCE(r.cnt, 0) AS "reviewCount",
        (SELECT m."storageKey" FROM "PortfolioMedia" m
           WHERE m."profileId" = p.id AND m.type = 'IMAGE'
           ORDER BY m."isCardImage" DESC, m."sortOrder" ASC LIMIT 1) AS "imageKey",
        EXISTS (SELECT 1 FROM "PortfolioMedia" m WHERE m."profileId" = p.id AND m.type = 'VIDEO') AS "hasVideo",
        CASE a."locationVisibility"
          WHEN 'EXACT' THEN a.latitude::float8
          WHEN 'APPROXIMATE' THEN COALESCE(c.latitude, round(a.latitude, 2))::float8
          ELSE c.latitude::float8 END AS lat,
        CASE a."locationVisibility"
          WHEN 'EXACT' THEN a.longitude::float8
          WHEN 'APPROXIMATE' THEN COALESCE(c.longitude, round(a.longitude, 2))::float8
          ELSE c.longitude::float8 END AS lng
      FROM "ProviderServiceProfile" p
      JOIN "ProviderAccount" a ON a.id = p."providerId"
      JOIN "User" u ON u.id = a."userId"
      JOIN "Category" cat ON cat.id = p."categoryId"
      JOIN "Wilaya" w ON w.code = a."wilayaCode"
      LEFT JOIN "Commune" c ON c.id = a."communeId"
      LEFT JOIN LATERAL (
        SELECT avg(rv.rating)::float8 AS avg, count(*)::int AS cnt
        FROM "Review" rv WHERE rv."profileId" = p.id AND rv.status = 'PUBLISHED'
      ) r ON true
      WHERE ${Prisma.join(conditions, " AND ")}
    ),
    d AS (SELECT b.*, ${distanceExpr} AS "distanceKm" FROM b)
    SELECT d.*, count(*) OVER () AS total
    FROM d
    ${distanceFilter}
    ORDER BY ${orderBy}
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;

  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    cards: rows.map((r) => ({
      slug: r.slug,
      providerSlug: r.providerSlug,
      businessName: r.businessName,
      headline: r.headline,
      specialties: r.specialties,
      startingPrice: r.startingPrice?.toString() ?? null,
      experienceYears: r.experienceYears,
      wilayaFr: r.wilayaFr,
      wilayaAr: r.wilayaAr,
      communeFr: r.communeFr,
      communeAr: r.communeAr,
      workplaceType: r.workplaceType,
      verified: r.verified,
      rating: r.rating,
      reviewCount: r.reviewCount,
      imageUrl: r.imageKey ? publicMediaUrl(r.imageKey) : null,
      hasVideo: r.hasVideo,
      distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm * 10) / 10,
    })),
  };
}
