import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export type PublicPricing = {
  trialDays: number | null;
  graceDays: number | null;
  categories: { slug: string; monthlyPrice: string }[];
};

function asInt(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Current per-category monthly price and trial/grace settings, exactly as configured by Admin. */
export async function getPublicPricing(): Promise<PublicPricing> {
  "use cache";
  cacheLife("hours");
  cacheTag("pricing");

  const now = new Date();
  const [settings, categories] = await Promise.all([
    db.platformSetting.findMany({ where: { key: { in: ["billing.trialDays", "billing.graceDays"] } } }),
    db.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        pricing: {
          where: { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          orderBy: { effectiveFrom: "desc" },
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
