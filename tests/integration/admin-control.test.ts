import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { providerSignUpSchema } from "@/lib/validation/auth";
import type { Actor, Role } from "@/server/policies/roles";
import { AdminBlocked, ForbiddenError, setUserSuspended } from "@/server/services/admin-users";
import { addCategoryPrice, deleteCategoryPrice, getPricingOverview } from "@/server/services/admin-pricing";
import { deleteAuditEntry, deleteCategory, deletePayment, deleteProvider, deleteUser } from "@/server/services/admin-delete";
import { ensureSubscription, recordPayment, runBillingCycle, setTrialDefault, setTrialEnd } from "@/server/services/billing";
import { deleteMessage, listMessages, setMessageStatus } from "@/server/services/messages";
import { listProviderQueue, queueTabCounts } from "@/server/services/review";
import { signUpProvider } from "@/server/services/auth";
import { AccountBlocked, changeMyPassword, updateMyAccount } from "@/server/services/account";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const DAY = 86_400_000;
const REASON = "Raison suffisamment longue pour le journal";
let superAdmin: Actor;
let admin: Actor;
let support: Actor;
let providerId: string;
let providerUserId: string;

async function staff(role: Role): Promise<Actor> {
  const u = await db.user.create({ data: { email: `${role}-${randomUUID()}@test.invalid`, fullName: `${role} Test`, passwordHash: "x", role, status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { id: u.id, role, status: "ACTIVE", emailVerified: true };
}

beforeEach(async () => {
  await resetDatabase();
  await db.$executeRawUnsafe(`TRUNCATE "SubscriptionPayment", "InvoiceLine", "Invoice", "SubscriptionItem", "ProviderSubscription", "CategorySubscriptionPricing", "PlatformSetting" RESTART IDENTITY CASCADE`);
  for (const c of await db.category.findMany()) {
    await db.categorySubscriptionPricing.create({ data: { categoryId: c.id, monthlyPrice: 30000, effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
  }
  superAdmin = await staff("SUPER_ADMIN");
  admin = await staff("ADMIN");
  support = await staff("SUPPORT");
  const account = await createProvider({ name: "Atelier Contrôle" });
  providerId = account.id;
  providerUserId = account.userId;
  await createProfile(account.id, "nails", { slug: "controle-nails" });
});

describe("provider queue", () => {
  it("lists new sign-ups under À vérifier and user suspensions under Suspendues", async () => {
    const fresh = await createProvider({ name: "Nouvelle Inscrite", status: "PENDING_REVIEW" });
    await db.providerAccount.update({ where: { id: fresh.id }, data: { status: "ONBOARDING" } });
    expect((await listProviderQueue(admin, "pending", undefined, 1)).rows.map((r) => r.businessName)).toEqual(["Nouvelle Inscrite"]);

    await setUserSuspended(admin, providerUserId, true, REASON);
    const suspended = await listProviderQueue(admin, "suspended", undefined, 1);
    expect(suspended.rows.map((r) => r.businessName)).toEqual(["Atelier Contrôle"]);
    expect(suspended.rows[0].user.status).toBe("SUSPENDED");
    expect(await queueTabCounts(admin)).toEqual({ pending: 1, approved: 1, suspended: 1, rejected: 0, all: 2 });

    // Restoring brings the account back exactly as it was: public again.
    await setUserSuspended(admin, providerUserId, false, "");
    expect((await db.user.findUniqueOrThrow({ where: { id: providerUserId } })).status).toBe("ACTIVE");
    expect((await listProviderQueue(admin, "suspended", undefined, 1)).total).toBe(0);
  });
});

describe("free trial", () => {
  it("ends the trial today (billing starts) or gives more free months, any time", async () => {
    await runBillingCycle();
    expect((await db.providerSubscription.findFirstOrThrow()).status).toBe("TRIALING");
    await expect(setTrialEnd(support, providerId, new Date())).rejects.toBeInstanceOf(ForbiddenError);

    expect(await setTrialEnd(admin, providerId, new Date(Date.now() - 1000))).toBe("ACTIVE");
    expect(await db.invoice.count()).toBe(1);

    const later = new Date(Date.now() + 90 * DAY);
    expect(await setTrialEnd(admin, providerId, later)).toBe("TRIALING");
    const sub = await db.providerSubscription.findFirstOrThrow();
    expect(sub.trialEndsAt!.toISOString()).toBe(later.toISOString());
    expect(sub.currentPeriodEnd!.getTime()).toBeGreaterThanOrEqual(later.getTime() - 1000);
    expect((await runBillingCycle()).invoices).toBe(0); // no new invoice during the free months
    expect(await db.auditLog.count({ where: { action: "subscription.trial.set" } })).toBe(2);
  });

  it("uses the default length for new subscriptions, 0 meaning no trial", async () => {
    await expect(setTrialDefault(admin, -1)).rejects.toMatchObject({ reason: "amount" });
    await setTrialDefault(admin, 0);
    const sub = await db.$transaction((tx) => ensureSubscription(tx, providerId));
    expect(Math.abs(sub.trialEndsAt!.getTime() - Date.now())).toBeLessThan(5000);
    await setTrialDefault(admin, 90);
    expect(await db.platformSetting.findUniqueOrThrow({ where: { key: "billing.trialDays" } })).toMatchObject({ value: 90 });
  });
});

describe("payments and prices", () => {
  async function openInvoice() {
    const sub = await db.$transaction((tx) => ensureSubscription(tx, providerId, new Date(Date.now() - 40 * DAY)));
    await db.providerSubscription.update({ where: { id: sub.id }, data: { trialEndsAt: new Date(Date.now() - 10 * DAY) } });
    await runBillingCycle();
    return db.invoice.findFirstOrThrow();
  }

  it("records a payment on the day it was received, and deleting it reopens the invoice", async () => {
    const invoice = await openInvoice();
    await expect(recordPayment(admin, invoice.id, { method: "CCP", reference: "CCP-1" })).rejects.toBeInstanceOf(ForbiddenError); // Super Admin only
    await expect(recordPayment(superAdmin, invoice.id, { method: "CCP", reference: "CCP-1", paidAt: new Date(Date.now() + 5 * DAY) })).rejects.toMatchObject({ reason: "date" });
    const day = new Date(Date.now() - 20 * DAY);
    await recordPayment(superAdmin, invoice.id, { method: "CCP", reference: "CCP-1", paidAt: day });
    const paid = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt!.toISOString()).toBe(day.toISOString());

    await expect(deletePayment(admin, paid.payments[0].id)).rejects.toBeInstanceOf(ForbiddenError); // Super Admin only
    await deletePayment(superAdmin, paid.payments[0].id);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("OVERDUE");
  });

  it("applies a back-dated price at once and deletes rows, never the last one", async () => {
    const nails = await db.category.findUniqueOrThrow({ where: { slug: "nails" } });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
    await addCategoryPrice(admin, nails.id, "45000", today);
    const current = () => getPricingOverview(admin).then((o) => o.categories.find((c) => c.slug === "nails")!.current!.monthlyPrice);
    expect(await current()).toBe("45000");
    const newest = await db.categorySubscriptionPricing.findFirstOrThrow({ where: { categoryId: nails.id, monthlyPrice: 45000 } });
    await deleteCategoryPrice(admin, newest.id);
    expect(await current()).toBe("30000");
    const last = await db.categorySubscriptionPricing.findFirstOrThrow({ where: { categoryId: nails.id } });
    await expect(deleteCategoryPrice(admin, last.id)).rejects.toMatchObject({ reason: "last" });
  });
});

describe("deletions", () => {
  it("deletes a professional with everything that depends on her (Super Admin only)", async () => {
    const sub = await db.$transaction((tx) => ensureSubscription(tx, providerId, new Date(Date.now() - 40 * DAY)));
    await db.providerSubscription.update({ where: { id: sub.id }, data: { trialEndsAt: new Date(Date.now() - 10 * DAY) } });
    await runBillingCycle();
    expect(await db.invoice.count()).toBe(1);

    await expect(deleteProvider(admin, providerId)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteProvider(superAdmin, providerId);
    expect(await db.providerAccount.count()).toBe(0);
    expect(await db.user.count({ where: { id: providerUserId } })).toBe(0);
    expect(await db.invoice.count()).toBe(0);
    expect(await db.providerServiceProfile.count()).toBe(0);
    expect(await db.auditLog.findFirstOrThrow({ where: { action: "user.delete" } })).toMatchObject({ actorId: superAdmin.id, entityId: providerUserId });
  });

  it("protects the deleting admin, the last Super Admin and categories in use", async () => {
    await expect(deleteUser(superAdmin, superAdmin.id)).rejects.toMatchObject({ reason: "self" });
    const other = await staff("SUPER_ADMIN");
    await deleteUser(other, superAdmin.id);
    await expect(deleteUser(other, other.id)).rejects.toMatchObject({ reason: "self" });
    const nails = await db.category.findUniqueOrThrow({ where: { slug: "nails" } });
    await expect(deleteCategory(other, nails.id)).rejects.toBeInstanceOf(AdminBlocked);
  });

  it("removes journal entries and notes the removal", async () => {
    await setUserSuspended(admin, providerUserId, true, REASON);
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "user.suspend" } });
    await deleteAuditEntry(superAdmin, entry.id);
    expect(await db.auditLog.count({ where: { id: entry.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "audit.delete" } })).toBe(1);
  });
});

describe("messages, alerts and account", () => {
  it("lets only the Super Admins read, sort and delete contact messages", async () => {
    const m = await db.supportRequest.create({ data: { name: "Amina", email: "amina@test.invalid", subject: "Question", message: "Bonjour, une question." } });
    await expect(listMessages(admin, "new", 1)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listMessages(superAdmin, "new", 1)).total).toBe(1);
    await setMessageStatus(superAdmin, m.id, "RESOLVED");
    expect((await listMessages(superAdmin, "done", 1)).total).toBe(1);
    await deleteMessage(superAdmin, m.id);
    expect(await db.supportRequest.count()).toBe(0);
  });

  it("alerts the team when a professional signs up (email to the Super Admins)", async () => {
    const input = providerSignUpSchema.parse({
      fullName: "Nouvelle Pro",
      businessName: "Salon Alerte",
      email: "alerte@test.invalid",
      phone: "0661234567",
      password: "Jasmin et rose 7",
      wilaya: "16",
      workplaceType: "SALON",
      categories: ["nails"],
      terms: "on",
    });
    expect((await signUpProvider(input, "fr")).status).toBe("created");
    const notes = await db.notification.findMany({ where: { type: "staff.provider" } });
    expect(notes.map((n) => n.userId).sort()).toEqual([admin.id, superAdmin.id].sort());
    const emails = (await db.outboxEvent.findMany()).filter((e) => (e.payload as { template: string }).template === "staff-alert");
    expect(emails).toHaveLength(1);
    expect((emails[0].payload as { to: string }).to).toMatch(/^SUPER_ADMIN-/);
  });

  it("changes the password only with the current one, and updates the profile", async () => {
    const hash = await hashPassword("Ancien mot 2026");
    await db.user.update({ where: { id: admin.id }, data: { passwordHash: hash } });
    await expect(changeMyPassword(admin, "faux mot 2026", "Nouveau mot 2026", null)).rejects.toBeInstanceOf(AccountBlocked);
    await expect(changeMyPassword(admin, "Ancien mot 2026", "court", null)).rejects.toMatchObject({ reason: "length" });
    await changeMyPassword(admin, "Ancien mot 2026", "Nouveau mot 2026", null);
    await updateMyAccount(admin, { fullName: "  Nadia   Admin ", phone: "0550 00 00 00", locale: "ar" });
    expect(await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { fullName: true, locale: true } })).toEqual({ fullName: "Nadia Admin", locale: "ar" });
  });
});
