import "server-only";
import { db } from "@/lib/db";
import { algiersMidnight, algiersToday, isValidPriceStart, parsePrice, priceStates, sortPriceRows } from "@/lib/pricing-dates";
import { canManageCatalog, canViewCatalog, type Actor } from "@/server/policies/roles";
import { AdminBlocked, ForbiddenError, UUID } from "./admin-users";

/**
 * Subscription prices per category, as a dated history: a change is a new row that starts on any
 * Algiers day (past, today or future). Rows are never edited; ADMIN and above can delete one, except
 * the last price of a category. Invoices keep a frozen copy of the price they were issued with, so
 * history changes never rewrite them. SUPPORT reads. Every change is audited.
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

/** Adds a price that starts at midnight (Algiers) on `day` (any day from 2020 to two years ahead). Audited. */
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

/** Removes one price row. The last remaining price of a category cannot go (billing needs one). Audited. */
export async function deleteCategoryPrice(actor: Actor, priceId: string) {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  if (!UUID.test(priceId)) throw new ForbiddenError();
  await db.$transaction(async (tx) => {
    const row = await tx.categorySubscriptionPricing.findUnique({ where: { id: priceId }, include: { category: { select: { slug: true } } } });
    if (!row) throw new ForbiddenError();
    await tx.$queryRaw`SELECT id FROM "Category" WHERE id = ${row.categoryId}::uuid FOR UPDATE`;
    if ((await tx.categorySubscriptionPricing.count({ where: { categoryId: row.categoryId } })) <= 1) throw new AdminBlocked("last");
    await tx.categorySubscriptionPricing.delete({ where: { id: row.id } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "subscription.price.delete",
        entityType: "CategorySubscriptionPricing",
        entityId: row.id,
        metadata: { category: row.category.slug, monthlyPrice: row.monthlyPrice.toString(), effectiveFrom: algiersToday(row.effectiveFrom) },
      },
    });
  });
  return ["pricing"];
}
