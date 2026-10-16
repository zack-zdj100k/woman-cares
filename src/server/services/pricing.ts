import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { addDays } from "@/lib/availability";
import { algiersMidnight, algiersToday } from "@/lib/pricing-dates";

export type PublicPricing = {
  trialDays: number | null;
  graceDays: number | null;
  categories: { slug: string; monthlyPrice: string }[];
};

function asInt(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Per-category monthly price in effect today (Algiers calendar day) and trial/grace settings,
 * exactly as configured by Admin. Call it after `connection()`: the day is read per request and
 * is part of the cache key, so a price scheduled for tomorrow appears at midnight, not an hour later.
 */
export async function getPublicPricing(now = new Date()): Promise<PublicPricing> {
  return pricingForDay(algiersToday(now));
}

async function pricingForDay(day: string): Promise<PublicPricing> {
  "use cache";
  cacheLife("hours");
  cacheTag("pricing");

  const nextDay = algiersMidnight(addDays(day, 1));
  const [settings, categories] = await Promise.all([
    db.platformSetting.findMany({ where: { key: { in: ["billing.trialDays", "billing.graceDays"] } } }),
    db.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        pricing: {
          // The latest row starting on or before today; same-day entries: the one created last.
          where: { effectiveFrom: { lt: nextDay }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: nextDay } }] },
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { monthlyPrice: true },
        },
      },
    }),
  ]);
  const setting = (key: string) => asInt(settings.find((s) => s.key === key)?.value);
  return {
    trialDays: setting("billing.trialDays"),
    graceDays: setting("billing.graceDays"),
    categories: categories
      .filter((c) => c.pricing[0])
      .map((c) => ({ slug: c.slug, monthlyPrice: c.pricing[0].monthlyPrice.toString() })),
  };
}
