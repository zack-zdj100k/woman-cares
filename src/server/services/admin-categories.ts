import "server-only";
import { db } from "@/lib/db";
import { canManageCatalog, canViewCatalog, type Actor } from "@/server/policies/roles";
import { publicProfileWhere } from "./discovery";
import { AdminBlocked, ForbiddenError, UUID } from "./admin-users";

/** Every public page that lists or shows a category's profiles, plus the price list (it lists active categories in order). */
function categoryTags(...slugs: string[]) {
  return ["profiles", "pricing", ...slugs.map((s) => `directory:${s}`)];
}

async function loadCategory(id: string) {
  if (!UUID.test(id)) throw new ForbiddenError();
  const category = await db.category.findUnique({ where: { id }, select: { id: true, slug: true, active: true, requiresCredentialReview: true, sortOrder: true } });
  if (!category) throw new ForbiddenError();
  return category;
}

/** The six categories in public order, with real counts (public profiles and all profiles). SUPPORT reads. */
export async function listAdminCategories(actor: Actor) {
  if (!canViewCatalog(actor)) throw new ForbiddenError();
  const [categories, visible] = await Promise.all([
    db.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: { id: true, slug: true, nameFr: true, nameAr: true, active: true, requiresCredentialReview: true, sortOrder: true, _count: { select: { profiles: true } } },
    }),
    // Counted with the public rule but without the category's own switch, to say what deactivation would hide.
    db.providerServiceProfile.groupBy({ by: ["categoryId"], where: { ...publicProfileWhere, category: {} }, _count: { _all: true } }),
  ]);
  const visibleBy = new Map(visible.map((v) => [v.categoryId, v._count._all]));
  return categories.map((c) => ({ ...c, published: visibleBy.get(c.id) ?? 0 }));
}

/**
 * Deactivating a category hides all its profiles at once: every public query requires an active
 * category (publicProfileWhere and the directory SQL). Nothing is deleted; reactivating shows them again.
 */
export async function setCategoryActive(actor: Actor, categoryId: string, active: boolean) {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  const c = await loadCategory(categoryId);
  if (c.active === active) throw new AdminBlocked("state");
  await db.$transaction([
    db.category.update({ where: { id: c.id }, data: { active } }),
    db.auditLog.create({ data: { actorId: actor.id, action: active ? "category.activate" : "category.deactivate", entityType: "Category", entityId: c.id, metadata: { category: c.slug } } }),
  ]);
  return categoryTags(c.slug);
}

/**
 * Whether new publications in this category need an approved, unexpired credential (as Botox does).
 * Profiles already published stay published; staff review them from the queue.
 */
export async function setCategoryCredentialReview(actor: Actor, categoryId: string, required: boolean) {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  const c = await loadCategory(categoryId);
  if (c.requiresCredentialReview === required) throw new AdminBlocked("state");
  await db.$transaction([
    db.category.update({ where: { id: c.id }, data: { requiresCredentialReview: required } }),
    db.auditLog.create({
      data: { actorId: actor.id, action: required ? "category.credentials.require" : "category.credentials.waive", entityType: "Category", entityId: c.id, metadata: { category: c.slug } },
    }),
  ]);
  return categoryTags(c.slug);
}

/** Moves a category one place up or down. The whole order is renumbered 1..n under a lock, so it never has gaps or ties. */
export async function moveCategory(actor: Actor, categoryId: string, direction: "up" | "down") {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  const c = await loadCategory(categoryId);
  const swapped = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Category" ORDER BY "sortOrder" FOR UPDATE`;
    const all = await tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { slug: "asc" }], select: { id: true, slug: true } });
    const i = all.findIndex((x) => x.id === c.id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) throw new AdminBlocked("order");
    [all[i], all[j]] = [all[j], all[i]];
    for (const [n, row] of all.entries()) await tx.category.update({ where: { id: row.id }, data: { sortOrder: n + 1 } });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "category.reorder", entityType: "Category", entityId: c.id, metadata: { category: c.slug, from: i + 1, to: j + 1, order: all.map((x) => x.slug) } },
    });
    return all[i].slug;
  });
  return categoryTags(c.slug, swapped);
}
