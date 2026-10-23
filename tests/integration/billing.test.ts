import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { Actor, Role } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { BillingBlocked, declarePayment, ensureSubscription, getMyBilling, recordDirectPayment, recordPayment, runBillingCycle, sendInvoice, setFreeTrialForAll, startSubscription, stopTrial, setSubscriptionTerms, verifyPayment } from "@/server/services/billing";
import { searchDirectory } from "@/server/services/directory";
import { parseDirectoryQuery } from "@/lib/validation/directory";
import sharp from "sharp";
import { readPaymentProof } from "@/server/services/payment-proofs";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const DAY = 86_400_000;
let admin: Actor;
let superAdmin: Actor;
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
  superAdmin = await staff("SUPER_ADMIN");
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
    await expect(verifyPayment(admin, p.id, true, null)).rejects.toBeInstanceOf(ForbiddenError); // Super Admin only
    await verifyPayment(superAdmin, p.id, true, null);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");
    await expect(verifyPayment(superAdmin, p.id, true, null)).rejects.toMatchObject({ reason: "state" });
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
    await expect(recordPayment(admin, invoice.id, { method: "CASH", reference: "Agence" })).rejects.toBeInstanceOf(ForbiddenError); // Super Admin only
    await expect(recordPayment(superAdmin, invoice.id, { method: "CASH", reference: "" })).rejects.toBeInstanceOf(BillingBlocked);
    await recordPayment(superAdmin, invoice.id, { method: "CASH", reference: "Agence Alger centre" });
    expect((await db.providerSubscription.findFirstOrThrow()).status).toBe("ACTIVE");
    expect(await slugs()).toContain("facture-nails");
  });
});

describe("a payment received with no invoice to pay (Super Admin)", () => {
  const cash = { amount: 20000, method: "CASH" as const, reference: "Reçu en agence" };

  it("creates the invoice for her current month, already paid, and the cycle never bills that month again", async () => {
    await db.providerServiceProfile.updateMany({ where: { providerId }, data: { status: "DRAFT", publishedAt: null } });
    await trialEndedAt(new Date(Date.now() - 2 * DAY));
    // Standard prices with nothing published: nothing was invoiced, so there was nothing to confirm.
    expect((await runBillingCycle()).invoices).toBe(0);
    await setSubscriptionTerms(superAdmin, providerId, { basis: "NEGOTIATED", negotiatedPrice: 20000, reason: "Prix convenu au salon" });
    const before = await db.providerSubscription.findFirstOrThrow({ where: { providerId } });

    const invoice = await recordDirectPayment(superAdmin, providerId, cash);
    expect(invoice.periodStart.getTime()).toBe(before.currentPeriodStart!.getTime());
    const saved = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
    expect(saved.status).toBe("PAID");
    expect(Number(saved.total)).toBe(20000);
    expect(saved.payments).toHaveLength(1);
    expect(saved.payments[0]).toMatchObject({ status: "PAID", method: "CASH", verifiedById: superAdmin.id });
    expect(await db.auditLog.count({ where: { action: "subscription.payment.record", actorId: superAdmin.id } })).toBe(1);

    // Published later: the cycle bills the following months, never the paid one.
    await db.providerServiceProfile.updateMany({ where: { providerId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await runBillingCycle(new Date(saved.periodEnd.getTime() + DAY));
    const starts = (await db.invoice.findMany({ where: { providerId }, orderBy: { periodStart: "asc" } })).map((i) => i.periodStart.getTime());
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("pays the next month in advance when the current one is already paid", async () => {
    await trialEndedAt(new Date(Date.now() - 2 * DAY));
    const first = await recordDirectPayment(superAdmin, providerId, cash);
    const second = await recordDirectPayment(superAdmin, providerId, { ...cash, reference: "Mois suivant" });
    expect(second.periodStart.getTime()).toBe(first.periodEnd.getTime());
  });

  it("refuses when an invoice is waiting, for anyone but a Super Admin, and bad amounts", async () => {
    await trialEndedAt(new Date(Date.now() - DAY));
    await runBillingCycle(); // published categories: an invoice is due
    await expect(recordDirectPayment(superAdmin, providerId, cash)).rejects.toMatchObject({ reason: "unpaid" });
    await db.invoiceLine.deleteMany({ where: { invoice: { providerId } } });
    await db.invoice.deleteMany({ where: { providerId } });
    for (const actor of [admin, support, pro]) await expect(recordDirectPayment(actor, providerId, cash)).rejects.toBeInstanceOf(ForbiddenError);
    for (const amount of [0, -5, 1.5, 2_000_000]) await expect(recordDirectPayment(superAdmin, providerId, { ...cash, amount })).rejects.toBeInstanceOf(BillingBlocked);
    await expect(recordDirectPayment(superAdmin, providerId, { ...cash, reference: "x" })).rejects.toMatchObject({ reason: "note" });
    expect(await db.subscriptionPayment.count()).toBe(0);
  });
});

describe("free time stopped: visible only while a paid month covers today", () => {
  const visible = async () => (await db.providerServiceProfile.findMany({ where: { providerId }, select: { billingVisible: true } })).every((p) => p.billingVisible);
  const sub = () => db.providerSubscription.findFirstOrThrow({ where: { providerId } });

  it("stopping her trial hides her at once; a payment shows her for the paid month; the next month hides her again", async () => {
    await runBillingCycle(); // trial: visible
    expect(await visible()).toBe(true);
    await stopTrial(admin, providerId);
    expect(await sub()).toMatchObject({ paidOnly: true, status: "EXPIRED" });
    expect(await visible()).toBe(false);
    // An invoice for the month went out (she has published categories at standard prices).
    expect(await db.invoice.count({ where: { providerId, status: "OPEN" } })).toBe(1);
    const invoice = await db.invoice.findFirstOrThrow({ where: { providerId, status: "OPEN" } });
    await recordPayment(superAdmin, invoice.id, { method: "CCP", reference: "CCP 778899" });
    expect((await sub()).status).toBe("ACTIVE");
    expect(await visible()).toBe(true);
    // After the paid month: hidden at once, no grace.
    await runBillingCycle(new Date(invoice.periodEnd.getTime() + 60_000));
    expect((await sub()).status).toBe("EXPIRED");
    expect(await visible()).toBe(false);
  });

  it("a new trial date gives free time back", async () => {
    await runBillingCycle();
    await stopTrial(admin, providerId);
    const { setTrialEnd } = await import("@/server/services/billing");
    await setTrialEnd(admin, providerId, new Date(Date.now() + 30 * DAY));
    expect(await sub()).toMatchObject({ paidOnly: false, status: "TRIALING" });
    expect(await visible()).toBe(true);
  });

  it("the switch for everyone stops every trial and new professionals start without one; switching back gives new ones a trial", async () => {
    await runBillingCycle();
    expect(await setFreeTrialForAll(superAdmin, false)).toEqual({ hidden: 1, total: 1 });
    expect(await visible()).toBe(false);
    const next = await createProvider({ name: "Nouvelle Sans Essai" });
    await createProfile(next.id, "nails", { slug: "sans-essai-nails" });
    await runBillingCycle();
    expect(await db.providerSubscription.findFirstOrThrow({ where: { providerId: next.id } })).toMatchObject({ paidOnly: true, status: "EXPIRED" });

    await setFreeTrialForAll(superAdmin, true);
    const later = await createProvider({ name: "Nouvelle Avec Essai" });
    await runBillingCycle();
    expect(await db.providerSubscription.findFirstOrThrow({ where: { providerId: later.id } })).toMatchObject({ paidOnly: false, status: "TRIALING" });
    expect((await sub()).paidOnly).toBe(true); // already stopped: stays paid-only
    for (const actor of [admin, support, pro]) await expect(setFreeTrialForAll(actor, false)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("sending an invoice, and the professional declaring her transfer with a proof", () => {
  it("she is told, declares with a photo, the Super Admin sees the proof and confirms", async () => {
    await db.providerServiceProfile.updateMany({ where: { providerId }, data: { status: "DRAFT", publishedAt: null } });
    await stopTrial(admin, providerId); // nothing published at standard prices: no invoice yet
    expect(await db.invoice.count({ where: { providerId } })).toBe(0);
    for (const actor of [admin, support, pro]) await expect(sendInvoice(actor, providerId, { amount: 15000 })).rejects.toBeInstanceOf(ForbiddenError);

    const invoice = await sendInvoice(superAdmin, providerId, { amount: 15000 });
    expect(invoice.status).toBe("OPEN");
    const mail = (await db.outboxEvent.findMany()).map((e) => e.payload as { template: string }).filter((p) => p.template === "billing-invoice");
    expect(mail).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: pro.id, type: "billing.billing-invoice" } })).toBe(1);
    await expect(sendInvoice(superAdmin, providerId, { amount: 15000 })).rejects.toMatchObject({ reason: "unpaid" });

    const photo = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c25a73" } }).png().toBuffer();
    await expect(declarePayment(pro, invoice.id, { method: "BARIDIMOB", reference: "BM-1", note: null, idempotencyKey: randomUUID(), proof: Buffer.from("not an image") })).rejects.toMatchObject({ reason: "type" });
    const payment = await declarePayment(pro, invoice.id, { method: "BARIDIMOB", reference: "BM-2026-10", note: null, idempotencyKey: randomUUID(), proof: photo });
    expect(payment.proofStorageKey).toMatch(/^payment-proofs\//);
    expect((await readPaymentProof(superAdmin, payment.id)).data.length).toBeGreaterThan(0);
    expect((await readPaymentProof(pro, payment.id)).pdf).toBe(false);
    await expect(readPaymentProof(admin, payment.id)).rejects.toBeInstanceOf(ForbiddenError);

    await verifyPayment(superAdmin, payment.id, true, null);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID");
    expect((await db.providerSubscription.findFirstOrThrow({ where: { providerId } })).status).toBe("ACTIVE");
  });
});

describe("a deleted subscription", () => {
  it("can be started again from her page", async () => {
    await runBillingCycle();
    await db.providerSubscription.deleteMany({ where: { providerId } });
    await expect(startSubscription(support, providerId)).rejects.toBeInstanceOf(ForbiddenError);
    await startSubscription(admin, providerId);
    expect(await db.providerSubscription.count({ where: { providerId } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "subscription.start" } })).toBe(1);
  });
});
