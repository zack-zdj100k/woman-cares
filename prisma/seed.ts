/**
 * Reference data only: wilayas, the six categories, the default plan, initial
 * subscription pricing and platform settings. Idempotent (safe to re-run).
 *
 * It deliberately creates NO professionals, reviews, bookings or users.
 * Demo data for local development lives in prisma/seed-demo.ts (never run in production).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { wilayas } from "../src/config/wilayas";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DEFAULT_MONTHLY_PRICE = "30000.00"; // DZD per billable category; editable by Admin.

const categories = [
  { slug: "coiffeuses", nameFr: "Coiffure", nameAr: "تصفيف الشعر", sortOrder: 1 },
  { slug: "esthetique", nameFr: "Esthétique", nameAr: "التجميل", sortOrder: 2 },
  { slug: "massage", nameFr: "Massage", nameAr: "التدليك", sortOrder: 3 },
  { slug: "nails", nameFr: "Ongles", nameAr: "الأظافر", sortOrder: 4 },
  { slug: "extensions-de-cils", nameFr: "Extensions de cils", nameAr: "تركيب الرموش", sortOrder: 5 },
  { slug: "botox", nameFr: "Botox", nameAr: "البوتوكس", sortOrder: 6, requiresCredentialReview: true },
];

async function main() {
  for (const w of wilayas) {
    await db.wilaya.upsert({
      where: { code: w.code },
      update: { nameFr: w.fr, nameAr: w.ar },
      create: { code: w.code, nameFr: w.fr, nameAr: w.ar },
    });
  }

  for (const c of categories) {
    const category = await db.category.upsert({
      where: { slug: c.slug },
      update: { nameFr: c.nameFr, nameAr: c.nameAr, sortOrder: c.sortOrder },
      create: { ...c, requiresCredentialReview: c.requiresCredentialReview ?? false },
    });
    const hasPrice = await db.categorySubscriptionPricing.findFirst({ where: { categoryId: category.id } });
    if (!hasPrice) {
      await db.categorySubscriptionPricing.create({
        data: { categoryId: category.id, monthlyPrice: DEFAULT_MONTHLY_PRICE, effectiveFrom: new Date("2026-01-01T00:00:00Z") },
      });
    }
  }

  await db.subscriptionPlan.upsert({
    where: { code: "per-category" },
    update: {},
    create: { code: "per-category", name: "Abonnement par catégorie", billingBasis: "PER_CATEGORY", trialDays: 30, graceDays: 7 },
  });

  const settings: Record<string, unknown> = {
    "billing.trialDays": 30,
    "billing.graceDays": 7,
    "billing.defaultMonthlyPriceDzd": 30000,
    "booking.pendingExpiryHours": 48,
    "booking.minNoticeMinutes": 120,
    "booking.maxAdvanceDays": 90,
    "contact.email": "", // set by the Admin before launch
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }

  console.log(`Seeded ${wilayas.length} wilayas, ${categories.length} categories, plan and settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
