import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canDelete, type Actor } from "@/server/policies/roles";
import { AdminBlocked, ForbiddenError, UUID } from "./admin-users";
import { recomputeSubscription } from "./billing";

/**
 * Permanent deletions from the admin (owner decision, 2026-10-17). Super Admins only, each in one
 * transaction that removes what depends on the record first, and each leaves an audit entry with a
 * short snapshot of what was removed. Files already stored (portfolio, credentials) stay on disk.
 */

type Tx = Prisma.TransactionClient;

function guard(actor: Actor, id: string) {
  if (!canDelete(actor)) throw new ForbiddenError();
  if (!UUID.test(id)) throw new ForbiddenError();
}

async function audit(tx: Tx, actor: Actor, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
  await tx.auditLog.create({ data: { actorId: actor.id, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue } });
}

/** Bookings and everything hanging from them (history, payments, photos, reviews and their reports). */
async function deleteBookings(tx: Tx, where: Prisma.BookingWhereInput) {
  const ids = (await tx.booking.findMany({ where, select: { id: true } })).map((b) => b.id);
  if (ids.length === 0) return 0;
  const reviews = (await tx.review.findMany({ where: { bookingId: { in: ids } }, select: { id: true } })).map((r) => r.id);
  await tx.reviewReport.deleteMany({ where: { reviewId: { in: reviews } } });
  await tx.review.deleteMany({ where: { id: { in: reviews } } });
  await tx.bookingPayment.deleteMany({ where: { bookingId: { in: ids } } });
  await tx.bookingReferenceMedia.deleteMany({ where: { bookingId: { in: ids } } });
  await tx.bookingStatusHistory.deleteMany({ where: { bookingId: { in: ids } } });
  await tx.booking.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function deleteSubscriptions(tx: Tx, where: Prisma.ProviderSubscriptionWhereInput) {
  const subs = (await tx.providerSubscription.findMany({ where, select: { id: true } })).map((s) => s.id);
  const invoices = (await tx.invoice.findMany({ where: { subscriptionId: { in: subs } }, select: { id: true } })).map((i) => i.id);
  await tx.subscriptionPayment.deleteMany({ where: { invoiceId: { in: invoices } } });
  await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invoices } } });
  await tx.invoice.deleteMany({ where: { id: { in: invoices } } });
  await tx.subscriptionItem.deleteMany({ where: { subscriptionId: { in: subs } } });
  await tx.providerSubscription.deleteMany({ where: { id: { in: subs } } });
  return { subscriptions: subs.length, invoices: invoices.length };
}

/** A professional account with its profiles, services, bookings, billing, requests and credentials. */
async function deleteProviderData(tx: Tx, providerId: string) {
  const profiles = (await tx.providerServiceProfile.findMany({ where: { providerId }, select: { id: true, slug: true, category: { select: { slug: true } } } }));
  const ids = profiles.map((p) => p.id);
  const bookings = await deleteBookings(tx, { OR: [{ providerId }, { profileId: { in: ids } }] });
  const billing = await deleteSubscriptions(tx, { providerId });
  await tx.review.deleteMany({ where: { profileId: { in: ids } } });
  await tx.subscriptionItem.deleteMany({ where: { profileId: { in: ids } } });
  await tx.providerService.deleteMany({ where: { profileId: { in: ids } } });
  await tx.providerServiceProfile.deleteMany({ where: { id: { in: ids } } });
  await tx.providerCredential.deleteMany({ where: { providerId } });
  await tx.providerCategoryRequest.deleteMany({ where: { providerId } });
  const account = await tx.providerAccount.delete({ where: { id: providerId }, select: { slug: true } });
  return { bookings, ...billing, profiles: profiles.length, tags: ["profiles", `provider:${account.slug}`, ...profiles.flatMap((p) => [`profile:${p.slug}`, `directory:${p.category.slug}`])] };
}

/** Any account. A professional's whole business goes with it; a client's bookings too. Never yourself. */
export async function deleteUser(actor: Actor, userId: string) {
  guard(actor, userId);
  if (userId === actor.id) throw new AdminBlocked("self");
  return db.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true, role: true, provider: { select: { id: true } } } });
    if (!u) throw new ForbiddenError();
    if (u.role === "SUPER_ADMIN" && (await tx.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } })) <= 1) throw new AdminBlocked("lastAdmin");
    const provider = u.provider ? await deleteProviderData(tx, u.provider.id) : null;
    const bookings = await deleteBookings(tx, { clientId: u.id });
    await tx.reviewReport.deleteMany({ where: { reporterId: u.id } });
    await tx.review.deleteMany({ where: { clientId: u.id } });
    await tx.user.delete({ where: { id: u.id } });
    await audit(tx, actor, "user.delete", "User", u.id, { email: u.email, name: u.fullName, role: u.role, bookings: bookings + (provider?.bookings ?? 0), invoices: provider?.invoices ?? 0 });
    return provider?.tags ?? [];
  });
}

/** From a professional's file: the account and its user. */
export async function deleteProvider(actor: Actor, providerId: string) {
  guard(actor, providerId);
  const p = await db.providerAccount.findUnique({ where: { id: providerId }, select: { userId: true } });
  if (!p) throw new ForbiddenError();
  return deleteUser(actor, p.userId);
}

/** A category nobody uses yet. One in use is deactivated instead (Catégories page). */
export async function deleteCategory(actor: Actor, categoryId: string) {
  guard(actor, categoryId);
  return db.$transaction(async (tx) => {
    const c = await tx.category.findUnique({ where: { id: categoryId }, select: { slug: true, nameFr: true } });
    if (!c) throw new ForbiddenError();
    const used = await Promise.all([
      tx.providerServiceProfile.count({ where: { categoryId } }),
      tx.providerCategoryRequest.count({ where: { categoryId } }),
      tx.providerCredential.count({ where: { categoryId } }),
      tx.invoiceLine.count({ where: { categoryId } }),
      tx.subscriptionItem.count({ where: { categoryId } }),
    ]);
    if (used.some((n) => n > 0)) throw new AdminBlocked("inUse");
    await tx.categorySubscriptionPricing.deleteMany({ where: { categoryId } });
    await tx.category.delete({ where: { id: categoryId } });
    await audit(tx, actor, "category.delete", "Category", categoryId, { category: c.slug, name: c.nameFr });
    return ["profiles", "pricing", `directory:${c.slug}`];
  });
}

/** A professional's subscription with its invoices and payments; the next cycle starts a new one. */
export async function deleteSubscription(actor: Actor, subscriptionId: string) {
  guard(actor, subscriptionId);
  return db.$transaction(async (tx) => {
    const s = await tx.providerSubscription.findUnique({ where: { id: subscriptionId }, select: { providerId: true, status: true } });
    if (!s) throw new ForbiddenError();
    const removed = await deleteSubscriptions(tx, { id: subscriptionId });
    // Without a subscription the profiles are not held back by billing.
    await tx.providerServiceProfile.updateMany({ where: { providerId: s.providerId }, data: { billingVisible: true } });
    await audit(tx, actor, "subscription.delete", "ProviderSubscription", subscriptionId, { providerId: s.providerId, status: s.status, invoices: removed.invoices });
    return ["profiles"];
  });
}

export async function deleteInvoice(actor: Actor, invoiceId: string) {
  guard(actor, invoiceId);
  return db.$transaction(async (tx) => {
    const i = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { number: true, total: true, status: true, subscriptionId: true } });
    if (!i) throw new ForbiddenError();
    await tx.subscriptionPayment.deleteMany({ where: { invoiceId } });
    await tx.invoiceLine.deleteMany({ where: { invoiceId } });
    await tx.invoice.delete({ where: { id: invoiceId } });
    await audit(tx, actor, "invoice.delete", "Invoice", invoiceId, { invoice: i.number, amount: i.total.toString(), status: i.status });
    await recomputeSubscription(tx, i.subscriptionId);
    return ["profiles"];
  });
}

/** One payment. A paid invoice no longer covered goes back to open (or overdue). */
export async function deletePayment(actor: Actor, paymentId: string, now = new Date()) {
  guard(actor, paymentId);
  return db.$transaction(async (tx) => {
    const p = await tx.subscriptionPayment.findUnique({ where: { id: paymentId }, include: { invoice: { select: { id: true, number: true, total: true, status: true, dueAt: true, subscriptionId: true } } } });
    if (!p) throw new ForbiddenError();
    await tx.subscriptionPayment.delete({ where: { id: paymentId } });
    const stillPaid = await tx.subscriptionPayment.aggregate({ where: { invoiceId: p.invoice.id, status: "PAID" }, _sum: { amount: true } });
    if (p.invoice.status === "PAID" && Number(stillPaid._sum.amount ?? 0) < Number(p.invoice.total)) {
      await tx.invoice.update({ where: { id: p.invoice.id }, data: { status: p.invoice.dueAt <= now ? "OVERDUE" : "OPEN", paidAt: null } });
    }
    await audit(tx, actor, "subscription.payment.delete", "SubscriptionPayment", paymentId, { invoice: p.invoice.number, amount: p.amount.toString(), status: p.status });
    await recomputeSubscription(tx, p.invoice.subscriptionId, now);
    return ["profiles"];
  });
}

/** Journal entries. The deletion itself is noted (count only), unless it is that note being removed. */
export async function deleteAuditEntry(actor: Actor, entryId: string) {
  guard(actor, entryId);
  await db.$transaction(async (tx) => {
    const e = await tx.auditLog.findUnique({ where: { id: entryId }, select: { action: true } });
    if (!e) throw new ForbiddenError();
    await tx.auditLog.delete({ where: { id: entryId } });
    if (e.action !== "audit.delete") await audit(tx, actor, "audit.delete", "AuditLog", entryId, { action: e.action });
  });
  return [];
}
