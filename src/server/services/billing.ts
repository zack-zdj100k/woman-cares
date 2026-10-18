import "server-only";
import { notifyStaff } from "./staff-alerts";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { isLocale } from "@/i18n/config";
import { addMonths, billingStatus, invoiceLines, invoiceNumber, isPubliclyVisible, type Basis, type BillableCategory, type SubStatus } from "@/lib/billing";
import { formatDate, formatDzd } from "@/lib/format";
import { renderEmail, type EmailTemplate, type TemplateData } from "@/lib/email/templates";
import { canReview, canSignIn, canViewModeration, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { enqueueEmail } from "./outbox";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

/** The request cannot be done in the current state (reason for the UI). */
export class BillingBlocked extends Error {
  constructor(public reason: "state" | "amount" | "note" | "pending" | "basis" | "date") {
    super(reason);
  }
}

const LABELS_FR = { negotiated: "Abonnement, prix convenu", package: "Abonnement, formule", category: (name: string) => `Abonnement ${name}` };

async function settings(tx: Prisma.TransactionClient = db) {
  const rows = await tx.platformSetting.findMany({ where: { key: { in: ["billing.trialDays", "billing.graceDays", "billing.dueDays"] } } });
  const num = (k: string, d: number) => {
    const v = rows.find((r) => r.key === k)?.value;
    return typeof v === "number" && v >= 0 ? v : d;
  };
  return { trialDays: num("billing.trialDays", 30), graceDays: num("billing.graceDays", 7), dueDays: num("billing.dueDays", 7) };
}

function rand6() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => a[randomInt(a.length)]).join("");
}

/** Price per category in effect at an instant (latest row starting on or before it). */
async function categoryPriceAt(tx: Prisma.TransactionClient, categoryId: string, at: Date) {
  const row = await tx.categorySubscriptionPricing.findFirst({
    where: { categoryId, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: { monthlyPrice: true },
  });
  return row ? Number(row.monthlyPrice) : 0;
}

/** Billable category profiles: published, or back in review after a first publication; never archived. */
async function billableCategories(tx: Prisma.TransactionClient, providerId: string, at: Date): Promise<BillableCategory[]> {
  const profiles = await tx.providerServiceProfile.findMany({
    where: { providerId, OR: [{ status: "PUBLISHED" }, { status: { in: ["PENDING_REVIEW", "RESTRICTED"] }, publishedAt: { not: null } }] },
    select: { category: { select: { id: true, slug: true, nameFr: true } } },
  });
  return Promise.all(profiles.map(async (p) => ({ categoryId: p.category.id, slug: p.category.slug, name: p.category.nameFr, monthlyPrice: await categoryPriceAt(tx, p.category.id, at) })));
}

/** The professional's subscription, created on first need (trial starts then). */
export async function ensureSubscription(tx: Prisma.TransactionClient, providerId: string, now = new Date()) {
  const existing = await tx.providerSubscription.findFirst({ where: { providerId }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  const [{ trialDays }, plan] = await Promise.all([settings(tx), tx.subscriptionPlan.findFirst({ where: { code: "per-category", active: true } })]);
  return tx.providerSubscription.create({
    data: { providerId, planId: plan?.id, status: "TRIALING", billingBasis: "PER_CATEGORY", trialEndsAt: new Date(now.getTime() + trialDays * DAY) },
  });
}

/** Raw billing facts; amounts and dates are formatted in each recipient's language. */
type BillingFacts = { reference?: string; amount?: string | number; when?: Date; note?: string | null };

async function notify(tx: Prisma.TransactionClient, providerId: string, template: EmailTemplate, facts: BillingFacts, dedupeKey: string) {
  const owner = await tx.providerAccount.findUnique({ where: { id: providerId }, select: { user: { select: { id: true, email: true, fullName: true, locale: true } } } });
  if (!owner) return;
  const u = owner.user;
  const locale = isLocale(u.locale) ? u.locale : "fr";
  const full: TemplateData = {
    reference: facts.reference,
    note: facts.note ?? null,
    amount: facts.amount !== undefined ? formatDzd(String(facts.amount), locale) : undefined,
    when: facts.when ? formatDate(facts.when, locale) : undefined,
    name: u.fullName.split(" ")[0], url: `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/${locale}/dashboard/provider/subscriptions` };
  const rendered = renderEmail(template, locale, full);
  const exists = await tx.notification.findFirst({ where: { userId: u.id, type: `billing.${template}`, data: { path: ["key"], equals: dedupeKey } } });
  if (!exists) await tx.notification.create({ data: { userId: u.id, type: `billing.${template}`, title: rendered.subject, body: rendered.text.split("\n").filter(Boolean)[1] ?? rendered.subject, data: { key: dedupeKey } } });
  await enqueueEmail(tx, { to: u.email, template, locale, data: full, dedupeKey });
}

/** Recompute status and directory visibility for one subscription; notify on transitions. */
async function refreshState(tx: Prisma.TransactionClient, subscriptionId: string, now: Date) {
  const sub = await tx.providerSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  const { graceDays } = await settings(tx);
  const unpaid = await tx.invoice.findFirst({ where: { subscriptionId, status: { in: ["OPEN", "OVERDUE"] } }, orderBy: { dueAt: "asc" } });
  const next = billingStatus({ status: sub.status as SubStatus, trialEndsAt: sub.trialEndsAt, oldestUnpaidDueAt: unpaid?.dueAt ?? null, graceDays, now });
  if (next.status !== sub.status || (next.graceEndsAt?.getTime() ?? 0) !== (sub.graceEndsAt?.getTime() ?? 0)) {
    await tx.providerSubscription.update({ where: { id: sub.id }, data: { status: next.status, graceEndsAt: next.graceEndsAt } });
    if (unpaid && next.status !== sub.status) {
      if (next.status === "GRACE") {
        await notify(tx, sub.providerId, "billing-grace", { reference: unpaid.number, amount: unpaid.total.toString(), when: next.graceEndsAt! }, `grace:${unpaid.id}`);
      } else if (next.status === "EXPIRED") {
        await notify(tx, sub.providerId, "billing-expired", { reference: unpaid.number, amount: unpaid.total.toString() }, `expired:${unpaid.id}`);
      }
    }
  }
  // Any unpaid invoice past its due date is overdue, whichever transition happened (even if the cycle skipped grace).
  await tx.invoice.updateMany({ where: { subscriptionId, status: "OPEN", dueAt: { lte: now } }, data: { status: "OVERDUE" } });
  const visible = isPubliclyVisible(next.status);
  await tx.providerServiceProfile.updateMany({ where: { providerId: sub.providerId, billingVisible: !visible }, data: { billingVisible: visible } });
  return next.status;
}

/** Issue invoices for periods that have started (at most 3 catch-up periods per run). */
async function issueDue(tx: Prisma.TransactionClient, subscriptionId: string, now: Date) {
  const sub = await tx.providerSubscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { plan: true } });
  if (sub.status === "EXEMPT" || sub.status === "SUSPENDED" || sub.status === "CANCELLED") return 0;
  const { dueDays } = await settings(tx);
  let periodStart = sub.currentPeriodEnd ?? sub.trialEndsAt;
  let issued = 0;
  for (let i = 0; periodStart && periodStart <= now && i < 3; i++) {
    const periodEnd = addMonths(periodStart, 1);
    const categories = await billableCategories(tx, sub.providerId, periodStart);
    const { lines, total } = invoiceLines({
      basis: sub.billingBasis as Basis,
      categories,
      negotiatedPrice: sub.negotiatedMonthlyPrice ? Number(sub.negotiatedMonthlyPrice) : null,
      packagePrice: sub.plan?.packagePrice ? Number(sub.plan.packagePrice) : null,
      labels: LABELS_FR,
    });
    if (total > 0) {
      const existing = await tx.invoice.findUnique({ where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } } });
      if (!existing) {
        const invoice = await tx.invoice.create({
          data: {
            number: invoiceNumber(periodStart, rand6()),
            subscriptionId: sub.id,
            providerId: sub.providerId,
            periodStart,
            periodEnd,
            subtotal: total,
            total,
            dueAt: new Date(periodStart.getTime() + dueDays * DAY),
            pricingBasisSnapshot: { basis: sub.billingBasis, negotiated: sub.negotiatedMonthlyPrice?.toString() ?? null, categories: categories.map((c) => ({ slug: c.slug, price: c.monthlyPrice })) },
            lines: { create: lines.map((l) => ({ categoryId: l.categoryId, description: l.description, amount: l.amount })) },
          },
        });
        issued += 1;
        await notify(tx, sub.providerId, "billing-invoice", { reference: invoice.number, amount: total, when: invoice.dueAt }, `invoice:${invoice.id}`);
      }
    }
    await tx.providerSubscription.update({ where: { id: sub.id }, data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd } });
    periodStart = periodEnd;
  }
  return issued;
}

/**
 * The billing cycle: creates missing subscriptions for approved professionals, issues due invoices,
 * moves statuses with time and recomputes directory visibility. Idempotent; run daily
 * (`npm run billing:cycle`) or from Admin › Abonnements.
 */
export async function runBillingCycle(now = new Date()) {
  const providers = await db.providerAccount.findMany({ where: { status: { in: ["APPROVED", "SUSPENDED"] } }, select: { id: true } });
  let invoices = 0;
  let changed = 0;
  for (const p of providers) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProviderAccount" WHERE id = ${p.id}::uuid FOR UPDATE`;
      const sub = await ensureSubscription(tx, p.id, now);
      const before = sub.status;
      invoices += await issueDue(tx, sub.id, now);
      if ((await refreshState(tx, sub.id, now)) !== before) changed += 1;
      // Trial ending in 3 days: one reminder.
      if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt.getTime() - now.getTime() < 3 * DAY && sub.trialEndsAt > now) {
        await notify(tx, p.id, "billing-trial-ending", { when: sub.trialEndsAt }, `trial-ending:${sub.id}`);
      }
    });
  }
  return { providers: providers.length, invoices, changed };
}

// ───────────── Professional side ─────────────

async function ownAccount(actor: Actor) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({ where: { userId: actor.id }, select: { id: true, status: true } });
  if (!account) throw new ForbiddenError();
  return account;
}

/** What the professional sees on Abonnement: status, dates, basis, billable categories and an estimate. */
export async function getMyBilling(actor: Actor, now = new Date()) {
  const account = await ownAccount(actor);
  const sub = await db.providerSubscription.findFirst({ where: { providerId: account.id }, orderBy: { createdAt: "desc" }, include: { plan: true } });
  const categories = await billableCategories(db, account.id, now);
  const estimate = sub
    ? invoiceLines({
        basis: sub.billingBasis as Basis,
        categories,
        negotiatedPrice: sub.negotiatedMonthlyPrice ? Number(sub.negotiatedMonthlyPrice) : null,
        packagePrice: sub.plan?.packagePrice ? Number(sub.plan.packagePrice) : null,
        labels: LABELS_FR,
      })
    : invoiceLines({ basis: "PER_CATEGORY", categories, negotiatedPrice: null, packagePrice: null, labels: LABELS_FR });
  const invoices = await db.invoice.findMany({
    where: { providerId: account.id },
    orderBy: { periodStart: "desc" },
    take: 24,
    include: { payments: { orderBy: { createdAt: "desc" } }, lines: { include: { category: { select: { slug: true } } } } },
  });
  return { accountStatus: account.status, subscription: sub, categories, estimate, invoices };
}

/** The professional declares a transfer for one of her invoices; staff verify it before it counts. */
export async function declarePayment(
  actor: Actor,
  invoiceId: string,
  input: { method: "MANUAL_TRANSFER" | "CCP" | "BARIDIMOB" | "CASH"; reference: string; note: string | null; idempotencyKey: string },
) {
  const account = await ownAccount(actor);
  if (!UUID.test(invoiceId) || !UUID.test(input.idempotencyKey)) throw new ForbiddenError();
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice || invoice.providerId !== account.id) throw new ForbiddenError();
  if (invoice.status === "PAID" || invoice.status === "VOID") throw new BillingBlocked("state");
  const key = `${actor.id}:${input.idempotencyKey}`;
  const same = invoice.payments.find((p) => p.idempotencyKey === key);
  if (same) return same;
  if (invoice.payments.some((p) => p.status === "PENDING")) throw new BillingBlocked("pending");
  const reference = input.reference.trim().slice(0, 120);
  if (reference.length < 3) throw new BillingBlocked("note");
  return db.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.create({
      data: { invoiceId: invoice.id, amount: invoice.total, status: "PENDING", method: input.method, externalReference: reference, note: input.note?.trim().slice(0, 500) || null, idempotencyKey: key, declaredById: actor.id },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "subscription.payment.declare", entityType: "SubscriptionPayment", entityId: payment.id, metadata: { invoice: invoice.number, method: input.method } } });
    const owner = await tx.providerAccount.findUniqueOrThrow({ where: { id: account.id }, select: { businessName: true } });
    await notifyStaff(tx, {
      kind: "payment",
      path: "/dashboard/admin/payments?status=PENDING",
      data: { client: owner.businessName, reference: invoice.number, amount: formatDzd(invoice.total.toString(), "fr") },
      dedupeKey: `staff:payment:${payment.id}`,
    });
    return payment;
  });
}

// ───────────── Staff side ─────────────

function requireBillingAdmin(actor: Actor) {
  if (!canReview(actor)) throw new ForbiddenError();
}

export type SubscriptionFilter = "all" | "TRIALING" | "ACTIVE" | "GRACE" | "EXPIRED" | "EXEMPT" | "NEGOTIATED";

export async function listSubscriptions(actor: Actor, filter: SubscriptionFilter, q: string | undefined, page: number) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  const where: Prisma.ProviderSubscriptionWhereInput = {
    ...(filter === "NEGOTIATED" ? { billingBasis: "NEGOTIATED" } : filter !== "all" ? { status: filter } : {}),
    ...(q ? { provider: { OR: [{ businessName: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }] } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.providerSubscription.count({ where }),
    db.providerSubscription.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 25,
      skip: (page - 1) * 25,
      include: {
        provider: { select: { id: true, businessName: true, user: { select: { email: true } } } },
        invoices: { where: { status: { in: ["OPEN", "OVERDUE"] } }, select: { total: true } },
      },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / 25)) };
}

/** Billing for one professional (Admin › Professionnelles › Abonnement). */
export async function getProviderBilling(actor: Actor, providerId: string, now = new Date()) {
  if (!canViewModeration(actor) || !UUID.test(providerId)) throw new ForbiddenError();
  const sub = await db.providerSubscription.findFirst({ where: { providerId }, orderBy: { createdAt: "desc" }, include: { plan: true } });
  const categories = await billableCategories(db, providerId, now);
  const invoices = await db.invoice.findMany({ where: { providerId }, orderBy: { periodStart: "desc" }, take: 12, include: { payments: { orderBy: { createdAt: "desc" } } } });
  const standard = invoiceLines({ basis: "PER_CATEGORY", categories, negotiatedPrice: null, packagePrice: null, labels: LABELS_FR }).total;
  return { subscription: sub, categories, invoices, standardMonthly: standard };
}

/**
 * Admin sets a professional's billing terms: standard per-category prices, an agreed monthly price,
 * or an exemption (with a reason). Applies from the next invoice; issued invoices never change.
 */
export async function setSubscriptionTerms(
  actor: Actor,
  providerId: string,
  terms: { basis: "PER_CATEGORY" | "NEGOTIATED" | "EXEMPT"; negotiatedPrice?: number | null; reason?: string | null },
) {
  requireBillingAdmin(actor);
  if (!UUID.test(providerId)) throw new ForbiddenError();
  if (terms.basis === "NEGOTIATED" && !(terms.negotiatedPrice && Number.isInteger(terms.negotiatedPrice) && terms.negotiatedPrice > 0 && terms.negotiatedPrice <= 1_000_000)) throw new BillingBlocked("amount");
  if ((terms.basis === "EXEMPT" || terms.basis === "NEGOTIATED") && (terms.reason?.trim().length ?? 0) < 5) throw new BillingBlocked("note");
  const account = await db.providerAccount.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!account) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ProviderAccount" WHERE id = ${providerId}::uuid FOR UPDATE`;
    const sub = await ensureSubscription(tx, providerId);
    const before = { basis: sub.billingBasis, negotiated: sub.negotiatedMonthlyPrice?.toString() ?? null, status: sub.status };
    const exempt = terms.basis === "EXEMPT";
    const updated = await tx.providerSubscription.update({
      where: { id: sub.id },
      data: {
        billingBasis: terms.basis,
        negotiatedMonthlyPrice: terms.basis === "NEGOTIATED" ? terms.negotiatedPrice : null,
        exemptReason: exempt ? terms.reason!.trim() : null,
        // Leaving an exemption resumes billing from today.
        status: exempt ? "EXEMPT" : sub.status === "EXEMPT" ? "ACTIVE" : sub.status,
        ...(sub.status === "EXEMPT" && !exempt ? { currentPeriodEnd: new Date() } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "subscription.terms.update",
        entityType: "ProviderSubscription",
        entityId: sub.id,
        metadata: { providerId, before, after: { basis: updated.billingBasis, negotiated: updated.negotiatedMonthlyPrice?.toString() ?? null, status: updated.status }, reason: terms.reason ?? null },
      },
    });
    await refreshState(tx, sub.id, new Date());
    return updated;
  });
}

/** Staff verify (or refuse) a declared transfer. Only a verified payment marks the invoice paid. */
export async function verifyPayment(actor: Actor, paymentId: string, approve: boolean, note: string | null) {
  requireBillingAdmin(actor);
  if (!UUID.test(paymentId)) throw new ForbiddenError();
  if (!approve && (note?.trim().length ?? 0) < 5) throw new BillingBlocked("note");
  return db.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
    if (!payment) throw new ForbiddenError();
    const updated = await tx.subscriptionPayment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: approve ? "PAID" : "FAILED", verifiedById: actor.id, verifiedAt: new Date(), ...(approve ? {} : { note: note!.trim() }) },
    });
    if (updated.count !== 1) throw new BillingBlocked("state");
    await settleInvoice(tx, payment.invoiceId);
    await tx.auditLog.create({
      data: { actorId: actor.id, action: approve ? "subscription.payment.verify" : "subscription.payment.reject", entityType: "SubscriptionPayment", entityId: payment.id, metadata: { invoice: payment.invoice.number, amount: payment.amount.toString(), note } },
    });
    await notify(
      tx,
      payment.invoice.providerId,
      approve ? "billing-paid" : "billing-refused",
      { reference: payment.invoice.number, amount: payment.amount.toString(), note: approve ? null : note!.trim() },
      `payment:${payment.id}:${approve ? "ok" : "no"}`,
    );
  });
}

/** Staff record a payment received directly (cash at an office, transfer seen on the account). */
export async function recordPayment(actor: Actor, invoiceId: string, input: { method: "MANUAL_TRANSFER" | "CCP" | "BARIDIMOB" | "CASH"; reference: string; paidAt?: Date | null }) {
  requireBillingAdmin(actor);
  if (!UUID.test(invoiceId)) throw new ForbiddenError();
  const reference = input.reference.trim().slice(0, 120);
  if (reference.length < 3) throw new BillingBlocked("note");
  // The day the money was received: any past day (a transfer noticed late), never the future.
  const paidAt = input.paidAt ?? new Date();
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + DAY || paidAt.getTime() < Date.UTC(2020, 0, 1)) throw new BillingBlocked("date");
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new ForbiddenError();
    if (invoice.status === "PAID" || invoice.status === "VOID") throw new BillingBlocked("state");
    const payment = await tx.subscriptionPayment.create({
      data: { invoiceId, amount: invoice.total, status: "PAID", method: input.method, externalReference: reference, verifiedById: actor.id, verifiedAt: paidAt, createdAt: paidAt },
    });
    await settleInvoice(tx, invoiceId, paidAt);
    await tx.auditLog.create({ data: { actorId: actor.id, action: "subscription.payment.record", entityType: "SubscriptionPayment", entityId: payment.id, metadata: { invoice: invoice.number, amount: invoice.total.toString(), method: input.method, paidAt: paidAt.toISOString() } } });
    await notify(tx, invoice.providerId, "billing-paid", { reference: invoice.number, amount: invoice.total.toString() }, `payment:${payment.id}:ok`);
  });
}

/** Mark an invoice paid once verified payments cover it, then refresh the subscription. */
async function settleInvoice(tx: Prisma.TransactionClient, invoiceId: string, paidAt = new Date()) {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: { where: { status: "PAID" } } } });
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  if (paid >= Number(invoice.total) && invoice.status !== "PAID") {
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt } });
  }
  await refreshState(tx, invoice.subscriptionId, new Date());
}

export async function listInvoices(actor: Actor, status: "all" | "OPEN" | "OVERDUE" | "PAID" | "VOID", page: number) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  const where: Prisma.InvoiceWhereInput = status === "all" ? {} : { status };
  const [total, rows, collected] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, orderBy: { issuedAt: "desc" }, take: 25, skip: (page - 1) * 25, include: { provider: { select: { id: true, businessName: true } } } }),
    db.subscriptionPayment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / 25)), collected: collected._sum.amount?.toString() ?? "0" };
}

export async function listPayments(actor: Actor, status: "PENDING" | "PAID" | "FAILED" | "all", page: number) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  const where: Prisma.SubscriptionPaymentWhereInput = status === "all" ? {} : { status };
  const [total, rows] = await Promise.all([
    db.subscriptionPayment.count({ where }),
    db.subscriptionPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 25,
      skip: (page - 1) * 25,
      include: { invoice: { select: { id: true, number: true, total: true, periodStart: true, periodEnd: true, provider: { select: { id: true, businessName: true } } } }, verifiedBy: { select: { fullName: true } } },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / 25)) };
}

// ───────────── Free trial (admin) ─────────────

/** Default free-trial length for professionals approved from now on (0 = no free trial). */
export async function getTrialDefault(actor: Actor) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  return (await settings()).trialDays;
}

export async function setTrialDefault(actor: Actor, days: number) {
  requireBillingAdmin(actor);
  if (!Number.isInteger(days) || days < 0 || days > 730) throw new BillingBlocked("amount");
  const before = (await settings()).trialDays;
  await db.$transaction([
    db.platformSetting.upsert({ where: { key: "billing.trialDays" }, create: { key: "billing.trialDays", value: days }, update: { value: days } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "subscription.trial.default", entityType: "PlatformSetting", entityId: "billing.trialDays", metadata: { from: before, to: days } } }),
  ]);
}

/**
 * Sets when one professional's free trial ends, to any date. A future date gives (or gives back)
 * free time: billing resumes at that date. Today or a past date ends the trial now, so the next
 * period is invoiced at once. Invoices already issued are kept; delete or void them separately.
 */
export async function setTrialEnd(actor: Actor, providerId: string, endsAt: Date, now = new Date()) {
  requireBillingAdmin(actor);
  if (!UUID.test(providerId) || Number.isNaN(endsAt.getTime())) throw new ForbiddenError();
  if (endsAt.getTime() < Date.UTC(2020, 0, 1) || endsAt.getTime() > now.getTime() + 5 * 365 * DAY) throw new BillingBlocked("date");
  const account = await db.providerAccount.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!account) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ProviderAccount" WHERE id = ${providerId}::uuid FOR UPDATE`;
    const sub = await ensureSubscription(tx, providerId, now);
    const fixed = sub.status === "EXEMPT" || sub.status === "SUSPENDED" || sub.status === "CANCELLED";
    const future = endsAt > now;
    await tx.providerSubscription.update({
      where: { id: sub.id },
      data: {
        trialEndsAt: endsAt,
        // Free time moves the next billing period to the end of the trial.
        ...(future && !fixed ? { status: "TRIALING", graceEndsAt: null, ...(sub.currentPeriodEnd && sub.currentPeriodEnd < endsAt ? { currentPeriodEnd: endsAt } : {}) } : {}),
        // Ending the trial before any billing period: periods start from the new end date.
        ...(!future && !sub.currentPeriodEnd ? { currentPeriodEnd: null } : {}),
      },
    });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "subscription.trial.set", entityType: "ProviderSubscription", entityId: sub.id, metadata: { providerId, from: sub.trialEndsAt?.toISOString() ?? null, to: endsAt.toISOString() } },
    });
    if (!fixed) await issueDue(tx, sub.id, now);
    return refreshState(tx, sub.id, now);
  });
}

/** Recomputes a subscription's status and directory visibility (after staff deletions). */
export function recomputeSubscription(tx: Prisma.TransactionClient, subscriptionId: string, now = new Date()) {
  return refreshState(tx, subscriptionId, now);
}
