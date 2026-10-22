import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { Actor, Role } from "@/server/policies/roles";
import { parseDirectoryQuery } from "@/lib/validation/directory";
import { algiersMidnight } from "@/lib/pricing-dates";
import { searchDirectory } from "@/server/services/directory";
import { getFeaturedProfiles } from "@/server/services/discovery";
import { getPublicProfile, getPublicProvider } from "@/server/services/profiles";
import { getPublicPricing } from "@/server/services/pricing";
import { AdminBlocked, ForbiddenError, changeUserRole, getUserDetail, listUsers, setUserSuspended } from "@/server/services/admin-users";
import { listAdminCategories, moveCategory, setCategoryActive, setCategoryCredentialReview } from "@/server/services/admin-categories";
import { addCategoryPrice, getPricingOverview } from "@/server/services/admin-pricing";
import { auditFilterOptions, listAuditLog } from "@/server/services/audit";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const SEED = [
  { slug: "coiffeuses", sortOrder: 1, requiresCredentialReview: false },
  { slug: "esthetique", sortOrder: 2, requiresCredentialReview: false },
  { slug: "massage", sortOrder: 3, requiresCredentialReview: false },
  { slug: "nails", sortOrder: 4, requiresCredentialReview: false },
  { slug: "extensions-de-cils", sortOrder: 5, requiresCredentialReview: false },
  { slug: "botox", sortOrder: 6, requiresCredentialReview: true },
];
const REASON = "Signalements répétés de clientes.";
const slugs = (r: { cards: { slug: string }[] }) => r.cards.map((c) => c.slug).sort();
const nailsDirectory = () => searchDirectory("nails", parseDirectoryQuery({}));

let superAdmin: Actor;
let admin: Actor;
let support: Actor;
let client: Actor;
let providerActor: Actor;
let providerUserId: string;
let providerSlug: string;

async function person(role: Role, email: string, name: string, o: { verified?: boolean } = {}): Promise<Actor> {
  const verified = o.verified ?? true;
  const u = await db.user.create({ data: { email, fullName: name, passwordHash: "x", role, status: verified ? "ACTIVE" : "PENDING_VERIFICATION", emailVerifiedAt: verified ? new Date() : null } });
  return { id: u.id, role, status: verified ? "ACTIVE" : "PENDING_VERIFICATION", emailVerified: verified };
}

async function category(slug: string) {
  return db.category.findUniqueOrThrow({ where: { slug } });
}

/** Categories are reference data shared with the other suites: put them back exactly as seeded. */
async function restoreCategories() {
  for (const c of SEED) await db.category.update({ where: { slug: c.slug }, data: { active: true, sortOrder: c.sortOrder, requiresCredentialReview: c.requiresCredentialReview } });
}

beforeEach(async () => {
  await resetDatabase();
  await restoreCategories();
  await db.categorySubscriptionPricing.deleteMany();
  superAdmin = await person("SUPER_ADMIN", "owner@test.invalid", "Owner Super");
  admin = await person("ADMIN", "admin@test.invalid", "Admin Nadia");
  support = await person("SUPPORT", "support@test.invalid", "Support Lina");
  client = await person("CLIENT", "amina@test.invalid", "Amina Benali");
  const account = await createProvider({ name: "Atelier Nour" });
  providerUserId = account.userId;
  providerSlug = account.slug;
  await db.user.update({ where: { id: account.userId }, data: { emailVerifiedAt: new Date() } });
  providerActor = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  await createProfile(account.id, "nails", { slug: "nour-nails" });
});

afterAll(async () => {
  await restoreCategories();
});

// ───────────── Users ─────────────

describe("users: reading", () => {
  it("lets SUPPORT list and open accounts, read-only; refuses clients and providers", async () => {
    const list = await listUsers(support, { page: 1 });
    expect(list.total).toBe(5);
    const file = await getUserDetail(support, client.id);
    expect(file.user.email).toBe("amina@test.invalid");
    expect(file.roles).toEqual([]);
    expect(file.canSuspend).toBe(false);
    expect(file.history).toBeNull(); // the audit trail is ADMIN+
    await expect(listUsers(client, { page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listUsers(providerActor, { page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getUserDetail(providerActor, client.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(support, client.id, "PROVIDER")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setUserSuspended(support, client.id, true, REASON)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("searches by name or email and filters by role and status, with pagination", async () => {
    expect((await listUsers(admin, { q: "benali", page: 1 })).rows.map((r) => r.email)).toEqual(["amina@test.invalid"]);
    expect((await listUsers(admin, { q: "SUPPORT@test", page: 1 })).total).toBe(1);
    expect((await listUsers(admin, { role: "PROVIDER", page: 1 })).total).toBe(1);
    await person("CLIENT", "pending@test.invalid", "Sara Pending", { verified: false });
    expect((await listUsers(admin, { status: "PENDING_VERIFICATION", page: 1 })).rows.map((r) => r.fullName)).toEqual(["Sara Pending"]);
    for (let i = 0; i < 26; i++) await db.user.create({ data: { email: `bulk${i}@test.invalid`, fullName: `Bulk ${i}`, passwordHash: "x" } });
    const page1 = await listUsers(admin, { q: "bulk", page: 1 });
    const page2 = await listUsers(admin, { q: "bulk", page: 2 });
    expect([page1.total, page1.pageCount, page1.rows.length, page2.rows.length]).toEqual([26, 2, 25, 1]);
  });

  it("shows ADMIN what it may change and the account's history", async () => {
    const file = await getUserDetail(admin, client.id);
    expect(file.roles).toEqual(["PROVIDER"]);
    expect(file.canSuspend).toBe(true);
    expect(file.history).toEqual([]);
    expect((await getUserDetail(admin, support.id)).roles).toEqual([]);
    expect((await getUserDetail(superAdmin, superAdmin.id)).roles).toEqual([]);
    await expect(getUserDetail(admin, "not-a-uuid")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("users: role changes", () => {
  it("only lets a Super Admin grant or remove staff roles, never on herself", async () => {
    await expect(changeUserRole(admin, client.id, "SUPPORT")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(admin, support.id, "CLIENT")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(superAdmin, superAdmin.id, "ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(changeUserRole(admin, admin.id, "SUPER_ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.auditLog.count()).toBe(0);

    await changeUserRole(superAdmin, client.id, "SUPPORT");
    await changeUserRole(superAdmin, support.id, "CLIENT");
    expect((await db.user.findUniqueOrThrow({ where: { id: client.id } })).role).toBe("SUPPORT");
    const rows = await db.auditLog.findMany({ where: { action: "user.role.change" }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.actorId, r.entityId, r.metadata])).toEqual([
      [superAdmin.id, client.id, { from: "CLIENT", to: "SUPPORT" }],
      [superAdmin.id, support.id, { from: "SUPPORT", to: "CLIENT" }],
    ]);
  });

  it("lets ADMIN move accounts between client and professional; a professional moved away disappears from public pages", async () => {
    expect(slugs(await nailsDirectory())).toEqual(["nour-nails"]);
    const tags = await changeUserRole(admin, providerUserId, "CLIENT");
    expect(tags).toEqual(expect.arrayContaining(["profiles", `provider:${providerSlug}`, "profile:nour-nails", "directory:nails"]));
    expect(slugs(await nailsDirectory())).toEqual([]);
    expect(await getPublicProfile("nour-nails")).toBeNull();
    expect(await getPublicProvider(providerSlug)).toBeNull();
    await changeUserRole(admin, providerUserId, "PROVIDER");
    expect(slugs(await nailsDirectory())).toEqual(["nour-nails"]);
  });

  it("gives a promoted client the professional account her space needs, without publishing anything", async () => {
    const promoted = await person("CLIENT", "promue@test.invalid", "Yasmine Promue");
    expect(await db.providerAccount.findUnique({ where: { userId: promoted.id } })).toBeNull();

    await changeUserRole(admin, promoted.id, "PROVIDER");

    const account = await db.providerAccount.findUniqueOrThrow({ where: { userId: promoted.id } });
    expect(account.status).toBe("ONBOARDING"); // never public: listings want an APPROVED account
    expect(account.businessName).toBe("Yasmine Promue");
    expect(account.slug).toBe("yasmine-promue");
    expect(account.wilayaCode).toBeGreaterThan(0);
    expect(await db.providerServiceProfile.count({ where: { providerId: account.id } })).toBe(0);
    expect(slugs(await nailsDirectory())).toEqual(["nour-nails"]); // nothing new on the public site

    // Moving her back and forth must not create a second account or collide on the slug.
    await changeUserRole(admin, promoted.id, "CLIENT");
    await changeUserRole(admin, promoted.id, "PROVIDER");
    expect(await db.providerAccount.count({ where: { userId: promoted.id } })).toBe(1);
  });
});

describe("users: suspension", () => {
  it("suspends with a reason, signs out, hides a professional's profiles and restores them", async () => {
    await db.session.create({ data: { userId: providerUserId, tokenHash: "h".repeat(64), expiresAt: new Date(Date.now() + 3_600_000) } });
    await expect(setUserSuspended(admin, providerUserId, true, "court")).rejects.toMatchObject({ reason: "note" });

    const tags = await setUserSuspended(admin, providerUserId, true, REASON);
    expect(tags).toEqual(expect.arrayContaining(["profiles", "profile:nour-nails", "directory:nails"]));
    expect(await db.session.count({ where: { userId: providerUserId } })).toBe(0);
    expect(slugs(await nailsDirectory())).toEqual([]);
    expect(await getPublicProfile("nour-nails")).toBeNull();
    expect(await getFeaturedProfiles()).toEqual([]);
    await expect(setUserSuspended(admin, providerUserId, true, REASON)).rejects.toBeInstanceOf(AdminBlocked);

    await setUserSuspended(admin, providerUserId, false, "");
    expect((await db.user.findUniqueOrThrow({ where: { id: providerUserId } })).status).toBe("ACTIVE");
    expect(slugs(await nailsDirectory())).toEqual(["nour-nails"]);
    await expect(setUserSuspended(admin, providerUserId, false, "")).rejects.toMatchObject({ reason: "state" });

    const audit = await db.auditLog.findMany({ where: { entityId: providerUserId }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["user.suspend", "user.restore"]);
    expect(audit[0].metadata).toMatchObject({ from: "ACTIVE", to: "SUSPENDED", reason: REASON });
    expect((await getUserDetail(admin, providerUserId)).history?.map((h) => h.action)).toEqual(["user.restore", "user.suspend"]);
  });

  it("restores an account to the status it had before the suspension", async () => {
    const pending = await person("CLIENT", "pending@test.invalid", "Sara Pending", { verified: false });
    await setUserSuspended(admin, pending.id, true, REASON);
    await setUserSuspended(admin, pending.id, false, "");
    expect((await db.user.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("PENDING_VERIFICATION");
    // Active without a confirmed email (accounts created before verification existed): back to ACTIVE.
    const legacy = await person("CLIENT", "legacy@test.invalid", "Lina Legacy", { verified: false });
    await db.user.update({ where: { id: legacy.id }, data: { status: "ACTIVE" } });
    await setUserSuspended(admin, legacy.id, true, REASON);
    await setUserSuspended(admin, legacy.id, false, "");
    expect((await db.user.findUniqueOrThrow({ where: { id: legacy.id } })).status).toBe("ACTIVE");
  });

  it("keeps staff suspensions for the Super Admin", async () => {
    await expect(setUserSuspended(admin, support.id, true, REASON)).rejects.toBeInstanceOf(ForbiddenError);
    await setUserSuspended(superAdmin, support.id, true, REASON);
    expect((await db.user.findUniqueOrThrow({ where: { id: support.id } })).status).toBe("SUSPENDED");
  });
});

// ───────────── Categories ─────────────

describe("categories", () => {
  it("lists the six categories in order with real counts; SUPPORT reads only", async () => {
    const list = await listAdminCategories(support);
    expect(list.map((c) => c.slug)).toEqual(SEED.map((c) => c.slug));
    expect(list.find((c) => c.slug === "nails")).toMatchObject({ published: 1, _count: { profiles: 1 } });
    const nails = await category("nails");
    await expect(setCategoryActive(support, nails.id, false)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(moveCategory(support, nails.id, "up")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setCategoryCredentialReview(support, nails.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAdminCategories(providerActor)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("deactivating hides every profile of the category from public queries and invalidates their caches", async () => {
    await addCategoryPrice(admin, (await category("nails")).id, "25000", "2026-02-01", new Date("2026-01-15T12:00:00Z"));
    expect((await getPublicPricing()).categories.map((c) => c.slug)).toContain("nails");
    const nails = await category("nails");

    const tags = await setCategoryActive(admin, nails.id, false);
    expect(tags).toEqual(expect.arrayContaining(["profiles", "directory:nails", "pricing"]));
    expect(slugs(await nailsDirectory())).toEqual([]);
    expect(await getPublicProfile("nour-nails")).toBeNull();
    expect(await getFeaturedProfiles()).toEqual([]);
    expect((await getPublicPricing()).categories.map((c) => c.slug)).not.toContain("nails");
    // Counted with the public rule minus the category switch: what reactivation would bring back.
    expect((await listAdminCategories(admin)).find((c) => c.slug === "nails")).toMatchObject({ active: false, published: 1 });
    await expect(setCategoryActive(admin, nails.id, false)).rejects.toMatchObject({ reason: "state" });

    await setCategoryActive(admin, nails.id, true);
    expect(slugs(await nailsDirectory())).toEqual(["nour-nails"]);
    const audit = await db.auditLog.findMany({ where: { entityType: "Category" }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => [a.action, a.actorId, a.entityId])).toEqual([
      ["category.deactivate", admin.id, nails.id],
      ["category.activate", admin.id, nails.id],
    ]);
  });

  it("reorders without gaps or ties, refuses moving past either end, and audits the new order", async () => {
    const nails = await category("nails");
    const tags = await moveCategory(admin, nails.id, "up");
    expect(tags).toEqual(expect.arrayContaining(["profiles", "pricing", "directory:nails", "directory:massage"]));
    const order = (await db.category.findMany({ orderBy: { sortOrder: "asc" } })).map((c) => [c.slug, c.sortOrder]);
    expect(order).toEqual([
      ["coiffeuses", 1],
      ["esthetique", 2],
      ["nails", 3],
      ["massage", 4],
      ["extensions-de-cils", 5],
      ["botox", 6],
    ]);
    await expect(moveCategory(admin, (await category("coiffeuses")).id, "up")).rejects.toMatchObject({ reason: "order" });
    await expect(moveCategory(admin, (await category("botox")).id, "down")).rejects.toMatchObject({ reason: "order" });
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "category.reorder" } });
    expect(audit.metadata).toMatchObject({ category: "nails", from: 4, to: 3 });
  });

  it("toggles the credential requirement, audited", async () => {
    const nails = await category("nails");
    const tags = await setCategoryCredentialReview(superAdmin, nails.id, true);
    expect(tags).toEqual(expect.arrayContaining(["profiles", "directory:nails"]));
    expect((await category("nails")).requiresCredentialReview).toBe(true);
    await expect(setCategoryCredentialReview(superAdmin, nails.id, true)).rejects.toMatchObject({ reason: "state" });
    await setCategoryCredentialReview(superAdmin, nails.id, false);
    expect((await db.auditLog.findMany({ where: { entityId: nails.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action)).toEqual([
      "category.credentials.require",
      "category.credentials.waive",
    ]);
  });
});

// ───────────── Pricing ─────────────

describe("pricing", () => {
  const OCT_16 = new Date("2026-10-16T10:00:00Z");

  it("adds a price row on any valid day (ADMIN+), audited", async () => {
    const nails = await category("nails");
    await expect(addCategoryPrice(support, nails.id, "35000", "2026-11-01", OCT_16)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addCategoryPrice(client, nails.id, "35000", "2026-11-01", OCT_16)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addCategoryPrice(admin, nails.id, "35000", "2019-12-31", OCT_16)).rejects.toMatchObject({ reason: "date" });
    await expect(addCategoryPrice(admin, nails.id, "35000", "2029-01-01", OCT_16)).rejects.toMatchObject({ reason: "date" });
    await expect(addCategoryPrice(admin, nails.id, "35000.50", "2026-11-01", OCT_16)).rejects.toMatchObject({ reason: "price" });
    await expect(addCategoryPrice(admin, "00000000-0000-0000-0000-000000000000", "35000", "2026-11-01", OCT_16)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.categorySubscriptionPricing.count()).toBe(0);

    expect(await addCategoryPrice(admin, nails.id, "35 000", "2026-11-01", OCT_16)).toEqual(["pricing"]);
    const row = await db.categorySubscriptionPricing.findFirstOrThrow();
    expect(row.effectiveFrom.toISOString()).toBe("2026-10-31T23:00:00.000Z"); // midnight in Algiers
    expect(row.monthlyPrice.toString()).toBe("35000");
    expect(row.createdById).toBe(admin.id);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "subscription.price.schedule" } });
    expect(audit).toMatchObject({ actorId: admin.id, entityType: "CategorySubscriptionPricing", entityId: row.id, metadata: { category: "nails", monthlyPrice: 35000, effectiveFrom: "2026-11-01" } });
  });

  it("the public price list shows the row in effect today and switches at midnight in Algiers", async () => {
    const nails = await category("nails");
    await addCategoryPrice(admin, nails.id, "30000", "2026-01-01", new Date("2025-12-01T10:00:00Z"));
    await addCategoryPrice(admin, nails.id, "32000", "2026-10-01", new Date("2026-09-01T10:00:00Z"));
    await addCategoryPrice(admin, nails.id, "36000", "2026-11-01", OCT_16);
    await addCategoryPrice(admin, nails.id, "35000", "2026-11-01", new Date(OCT_16.getTime() + 60_000)); // correction, same day

    const priceOn = async (iso: string) => (await getPublicPricing(new Date(iso))).categories.find((c) => c.slug === "nails")?.monthlyPrice;
    expect(await priceOn("2026-10-16T10:00:00Z")).toBe("32000");
    expect(await priceOn("2026-10-31T22:59:00Z")).toBe("32000"); // 23:59 in Algiers
    expect(await priceOn("2026-10-31T23:00:00Z")).toBe("35000"); // 00:00 in Algiers: the correction wins
    expect(await priceOn("2026-06-01T10:00:00Z")).toBe("30000");
    expect(await priceOn("2025-12-15T10:00:00Z")).toBeUndefined();

    const overview = await getPricingOverview(support, OCT_16);
    const n = overview.categories.find((c) => c.slug === "nails")!;
    expect(n.current).toMatchObject({ monthlyPrice: "32000", day: "2026-10-01" });
    expect(n.next).toMatchObject({ monthlyPrice: "35000", day: "2026-11-01" });
    expect(n.rows.map((r) => [r.monthlyPrice, r.state])).toEqual([
      ["35000", "upcoming"],
      ["36000", "replaced"],
      ["32000", "current"],
      ["30000", "past"],
    ]);
    expect(n.rows[0].createdBy).toBe("Admin Nadia");
    await expect(getPricingOverview(providerActor)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("never changes existing rows when a new price is added", async () => {
    const nails = await category("nails");
    await addCategoryPrice(admin, nails.id, "30000", "2026-10-01", new Date("2026-09-01T10:00:00Z"));
    const before = await db.categorySubscriptionPricing.findFirstOrThrow();
    await addCategoryPrice(superAdmin, nails.id, "40000", "2026-12-01", OCT_16);
    const after = await db.categorySubscriptionPricing.findUniqueOrThrow({ where: { id: before.id } });
    expect(after).toEqual(before);
    expect(algiersMidnight("2026-10-01")).toEqual(before.effectiveFrom);
  });
});

// ───────────── Audit log ─────────────

describe("audit log browser", () => {
  beforeEach(async () => {
    await setUserSuspended(admin, client.id, true, REASON);
    await changeUserRole(superAdmin, support.id, "ADMIN");
    await setCategoryActive(admin, (await category("massage")).id, false);
    await db.auditLog.create({ data: { action: "superadmin.bootstrap.create", entityType: "User", entityId: superAdmin.id, createdAt: new Date("2026-01-05T10:00:00Z") } });
  });

  it("is ADMIN+ only", async () => {
    await expect(listAuditLog(support, { page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(auditFilterOptions(support)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAuditLog(providerActor, { page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listAuditLog(admin, { page: 1 })).total).toBe(4);
  });

  it("filters by action, actor (including the system), entity type and date range", async () => {
    const actions = async (f: Parameters<typeof listAuditLog>[1]) => (await listAuditLog(admin, f)).rows.map((r) => r.action);
    expect(await actions({ action: "user.suspend", page: 1 })).toEqual(["user.suspend"]);
    expect(await actions({ actor: superAdmin.id, page: 1 })).toEqual(["user.role.change"]);
    expect(await actions({ actor: "system", page: 1 })).toEqual(["superadmin.bootstrap.create"]);
    expect((await actions({ entityType: "Category", page: 1 }))).toEqual(["category.deactivate"]);
    expect(await actions({ from: "2026-01-01", to: "2026-01-05", page: 1 })).toEqual(["superadmin.bootstrap.create"]);
    expect(await actions({ from: "2026-01-06", entityType: "User", page: 1 })).toEqual(["user.role.change", "user.suspend"]);
    // The end day is inclusive in Algiers time: 2026-01-05 23:30 Algiers is still "the 5th".
    await db.auditLog.create({ data: { action: "late", entityType: "User", entityId: client.id, createdAt: new Date("2026-01-05T22:30:00Z") } });
    expect(await actions({ to: "2026-01-05", page: 1 })).toEqual(["late", "superadmin.bootstrap.create"]);
    const options = await auditFilterOptions(admin);
    expect(options.actions).toEqual(["category.deactivate", "late", "superadmin.bootstrap.create", "user.role.change", "user.suspend"]);
    expect(options.entityTypes).toEqual(["Category", "User"]);
    expect(options.actors.map((a) => a.fullName)).toEqual(["Admin Nadia", "Owner Super"]);
    expect(options.hasSystem).toBe(true);
  });

  it("paginates newest first", async () => {
    for (let i = 0; i < 50; i++) await db.auditLog.create({ data: { action: "bulk", entityType: "User", entityId: client.id, createdAt: new Date(Date.UTC(2026, 2, 1, 0, i)) } });
    const p1 = await listAuditLog(admin, { action: "bulk", page: 1 });
    const p2 = await listAuditLog(admin, { action: "bulk", page: 2 });
    expect([p1.total, p1.pageCount, p1.rows.length, p2.rows.length]).toEqual([50, 1, 50, 0]);
    const all = await listAuditLog(admin, { page: 2 });
    expect(all.pageCount).toBe(2);
    expect(all.rows).toHaveLength(4);
    expect(p1.rows[0].createdAt.getTime()).toBeGreaterThan(p1.rows[49].createdAt.getTime());
  });
});
