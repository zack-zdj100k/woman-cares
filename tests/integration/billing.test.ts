import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { Actor, Role } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { BillingBlocked, declarePayment, ensureSubscription, getMyBilling, recordPayment, runBillingCycle, setSubscriptionTerms, verifyPayment } from "@/server/services/billing";
import { searchDirectory } from "@/server/services/directory";
import { parseDirectoryQuery } from "@/lib/validation/directory";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const DAY = 86_400_000;
let admin: Actor;
let support: Actor;
let pro: Actor;
let providerId: string;
const slugs = async () => (await searchDirectory("nails", parseDirectoryQuery({}))).cards.map((c) => c.slug);

async function staff(role: Role): Promise<Actor> {
  const u = await db.user.create({ data: { email: `${role}-${randomUUID()}@test.invalid`, fullName: `${role} Test`, passwordHash: "x", role, status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { id: u.id, role, status: "ACTIVE", emailVerified: true };
}

beforeEach(async () => {
  await resetDatabase();
  await db.$executeRawUnsafe(`TRUNCATE "SubscriptionPayment", "InvoiceLine", "Invoice", "SubscriptionItem", "ProviderSubscription", "CategorySubscriptionPricing" RESTART IDENTITY CASCADE`);
  // Resetting users cascades into price rows: give every category its default price again.
  for (const c of await db.category.findMany()) {
    await db.categorySubscriptionPricing.create({ data: { categoryId: c.id, monthlyPrice: 30000, effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
  }
  admin = await staff("ADMIN");
  support = await staff("SUPPORT");
  const account = await createProvider({ name: "Atelier Facture" });
  providerId = account.id;
  pro = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  await createProfile(account.id, "nails", { slug: "facture-nails" });
  await createProfile(account.id, "coiffeuses", { slug: "facture-hair" });
});

/** A subscription whose trial ended at `trialEnd`. */
async function trialEndedAt(trialEnd: Date) {
  const sub = await db.$transaction((tx) => ensureSubscription(tx, providerId, new Date(trialEnd.getTime() - 30 * DAY)));
  await db.providerSubscription.update({ where: { id: sub.id }, data: { trialEndsAt: trialEnd } });
  return sub;
}

describe("trial and invoices", () => {
  it("creates the subscription in trial, with no invoice before the trial ends", async () => {
    const r = await runBillingCycle();
    expect(r.invoices).toBe(0);
    const sub = await db.providerSubscription.findFirstOrThrow({ where: { providerId } });
    expect(sub.status).toBe("TRIALING");
    expect(sub.trialEndsAt!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it("bills each published category at its current price, once per period", async () => {
    await trialEndedAt(new Date(Date.now() - DAY));
    expect((await runBillingCycle()).invoices).toBe(1);
    expect((await runBillingCycle()).invoices).toBe(0);
    const invoice = await db.invoice.findFirstOrThrow({ include: { lines: true } });
    expect(Number(invoice.total)).toBe(60000);
    expect(invoice.lines).toHaveLength(2);
    expect(invoice.status).toBe("OPEN");
    expect((await db.providerSubscription.findFirstOrThrow()).status).toBe("ACTIVE");
    const emails = (await db.outboxEvent.findMany()).map((e) => (e.payload as { template: string }).template);
    expect(emails).toContain("billing-invoice");
  });
});

describe("Admin sets a professional's price (request: change her payment price)", () => {
  it("applies an agreed monthly price to the next invoice, never to issued ones", async () => {
    await trialEndedAt(new Date(Date.now() - DAY));
    await runBillingCycle();
    const first = await db.invoice.findFirstOrThrow();

    await expect(setSubscriptionTerms(support, providerId, { basis: "NEGOTIATED", negotiatedPrice: 20000, reason: "Accord salon" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setSubscriptionTerms(pro, providerId, { basis: "NEGOTIATED", negotiatedPrice: 20000, reason: "Accord salon" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setSubscriptionTerms(admin, providerId, { basis: "NEGOTIATED", negotiatedPrice: 0, reason: "Accord salon" })).rejects.toMatchObject({ reason: "amount" });
    await expect(setSubscriptionTerms(admin, providerId, { basis: "NEGOTIATED", negotiatedPrice: 20000, reason: "" })).rejects.toMatchObject({ reason: "note" });
    await setSubscriptionTerms(admin, providerId, { basis: "NEGOTIATED", negotiatedPrice: 20000, reason: "Accord salon partenaire" });

    expect(Number((await db.invoice.findUniqueOrThrow({ where: { id: first.id } })).total)).toBe(60000);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "subscription.terms.update" } });
    expect(audit.actorId).toBe(admin.id);

    // Next period: the agreed price.
    const sub = await db.providerSubscription.findFirstOrThrow();
    await db.providerSubscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
    await runBillingCycle();
    const second = await db.invoice.findFirstOrThrow({ where: { id: { not: first.id } }, include: { lines: true } });
    expect(Number(second.total)).toBe(20000);
    expect(second.lines.map((l) => l.description)).toEqual(["Abonnement, prix convenu"]);
    expect((await getMyBilling(pro)).estimate.total).toBe(20000);
  });

  it("an exemption issues no invoice and keeps profiles visible", async () => {
    await setSubscriptionTerms(admin, providerId, { basis: "EXEMPT", reason: "Partenaire de lancement" });
    await trialEndedAt(new Date(Date.now() - 40 * DAY));
    await runBillingCycle();
    expect(await db.invoice.count()).toBe(0);
    expect((await db.providerSubscription.findFirstOrThrow()).status).toBe("EXEMPT");
    expect(await slugs()).toContain("facture-nails");
  });
});

describe("payments", () => {
  it("a declared transfer counts only once staff verify it", async () => {
    await trialEndedAt(new Date(Date.now() - DAY));
    await runBillingCycle();
    const invoice = await db.invoice.findFirstOrThrow();
    const other = await createProvider({ name: "Autre" });
    const otherPro: Actor = { id: other.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
    await expect(declarePayment(otherPro, invoice.id, { method: "CCP", reference: "REF-1", note: null, idempotencyKey: randomUUID() })).rejects.toBeInstanceOf(ForbiddenError);

    const key = randomUUID();
    const p = await declarePayment(pro, invoice.id, { method: "BARIDIMOB", reference: "BM-778899", note: "Payé ce matin", idempotencyKey: key });
    expect((await declarePayment(pro, invoice.id, { method: "BARIDIMOB", reference: "BM-778899", note: null, idempotencyKey: key })).id).toBe(p.id);
    await expect(declarePayment(pro, invoice.id, { method: "CCP", reference: "OTHER", note: null, idempotencyKey: randomUUID() })).rejects.toMatchObject({ reason: "pending" });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("OPEN");

    await expect(verifyPayment(pro, p.id, true, null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(verifyPayment(support, p.id, true, null)).rejects.toBeInstanceOf(ForbiddenError);
    await verifyPayment(admin, p.id, true, null);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");
    await expect(verifyPayment(admin, p.id, true, null)).rejects.toMatchObject({ reason: "state" });
    expect(await db.auditLog.count({ where: { action: "subscription.payment.verify" } })).toBe(1);
  });

  it("overdue → grace → profiles hidden, and a recorded payment brings them back", async () => {
    await trialEndedAt(new Date(Date.now() - 20 * DAY));
    await runBillingCycle(); // invoice dated at trial end, due 7 days later: grace ends 14 days after trial end
    const sub = await db.providerSubscription.findFirstOrThrow();
    expect(sub.status).toBe("EXPIRED");
    expect(await slugs()).not.toContain("facture-nails");
    expect((await db.providerServiceProfile.count({ where: { providerId } }))).toBe(2); // nothing deleted

    const invoice = await db.invoice.findFirstOrThrow();
    expect(invoice.status).toBe("OVERDUE");
    await expect(recordPayment(admin, invoice.id, { method: "CASH", reference: "" })).rejects.toBeInstanceOf(BillingBlocked);
    await recordPayment(admin, invoice.id, { method: "CASH", reference: "Agence Alger centre" });
    expect((await db.providerSubscription.findFirstOrThrow()).status).toBe("ACTIVE");
    expect(await slugs()).toContain("facture-nails");
  });
});
