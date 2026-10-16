import "server-only";
import { db } from "@/lib/db";
import { algiersMidnight, algiersToday, isValidPriceStart, parsePrice, priceStates, sortPriceRows } from "@/lib/pricing-dates";
import { canManageCatalog, canViewCatalog, type Actor } from "@/server/policies/roles";
import { AdminBlocked, ForbiddenError, UUID } from "./admin-users";

/**
 * Subscription prices per category, as an append-only history: a change is a new row that starts on a
 * future Algiers day. Past and current rows are never edited, so invoices and what professionals were
 * shown can always be explained. SUPPORT reads; ADMIN and above schedule new prices.
 */
export async function getPricingOverview(actor: Actor, now = new Date()) {
  if (!canViewCatalog(actor)) throw new ForbiddenError();
  const today = algiersToday(now);
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      slug: true,
      nameFr: true,
      nameAr: true,
      active: true,
      pricing: { select: { id: true, monthlyPrice: true, effectiveFrom: true, effectiveTo: true, createdAt: true, createdBy: { select: { fullName: true } } } },
    },
  });
  return {
    today,
    categories: categories.map((c) => {
      const states = priceStates(c.pricing, today);
      const rows = sortPriceRows(c.pricing).map((r) => ({
        id: r.id,
        monthlyPrice: r.monthlyPrice.toString(),
        day: algiersToday(r.effectiveFrom),
        createdAt: r.createdAt,
        createdBy: r.createdBy?.fullName ?? null,
        state: states.get(r.id)!,
      }));
      return {
        id: c.id,
        slug: c.slug,
        nameFr: c.nameFr,
        nameAr: c.nameAr,
        active: c.active,
        current: rows.find((r) => r.state === "current") ?? null,
        // The next change: the earliest upcoming day (its latest entry wins).
        next: rows.filter((r) => r.state === "upcoming").at(-1) ?? null,
        rows,
      };
    }),
  };
}

/** Adds a price that starts at midnight (Algiers) on `day`, which must be tomorrow or later. Audited. */
export async function addCategoryPrice(actor: Actor, categoryId: string, price: string, day: string, now = new Date()) {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  if (!UUID.test(categoryId)) throw new ForbiddenError();
  const monthlyPrice = parsePrice(price);
  if (monthlyPrice === null) throw new AdminBlocked("price");
  const today = algiersToday(now);
  if (!isValidPriceStart(day, today)) throw new AdminBlocked("date");
  const category = await db.category.findUnique({ where: { id: categoryId }, select: { id: true, slug: true } });
  if (!category) throw new ForbiddenError();

  await db.$transaction(async (tx) => {
    const row = await tx.categorySubscriptionPricing.create({
      data: { categoryId: category.id, monthlyPrice: monthlyPrice.toFixed(2), effectiveFrom: algiersMidnight(day), createdById: actor.id },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "subscription.price.schedule",
        entityType: "CategorySubscriptionPricing",
        entityId: row.id,
        metadata: { category: category.slug, monthlyPrice, effectiveFrom: day },
      },
    });
  });
  return ["pricing"];
}
