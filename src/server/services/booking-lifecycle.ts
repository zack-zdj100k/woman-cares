import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { clientActions, clientLabel, paymentSummary, PAYMENT_METHODS, providerActions, type BookingStatus, type PaymentMethod } from "@/lib/booking-rules";
import { canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { BookingBlocked, loadAvailability, notify, UUID } from "./bookings";

/**
 * Everything that happens to a booking after the request: cancellations, reschedule proposals and
 * answers, completion, no-show, payments recorded by the professional, reviews and expiry. Every
 * change is a status-guarded write with a history row, so two tabs (or two people) cannot both win.
 */

const people = {
  client: { select: { id: true, email: true, fullName: true, locale: true } },
  provider: { select: { id: true, userId: true, user: { select: { id: true, email: true, fullName: true, locale: true } } } },
} as const;

async function loadForClient(actor: Actor, bookingId: string) {
  if (actor.role !== "CLIENT" || !canSignIn(actor.status) || !UUID.test(bookingId)) throw new ForbiddenError();
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { ...people, review: { select: { id: true } } } });
  if (!b || b.clientId !== actor.id) throw new ForbiddenError();
  return b;
}

async function loadForProvider(actor: Actor, bookingId: string) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status) || !UUID.test(bookingId)) throw new ForbiddenError();
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { ...people, service: { select: { durationMinutes: true, bufferMinutes: true } } } });
  if (!b || b.provider.userId !== actor.id) throw new ForbiddenError();
  return b;
}

async function move(tx: Prisma.TransactionClient, id: string, from: BookingStatus[], to: BookingStatus, actorId: string | null, reason: string | null, data: Prisma.BookingUpdateManyMutationInput = {}) {
  const current = await tx.booking.findUniqueOrThrow({ where: { id }, select: { status: true } });
  const updated = await tx.booking.updateMany({ where: { id, status: { in: from } }, data: { ...data, status: to } });
  if (updated.count !== 1) throw new BookingBlocked("state");
  await tx.bookingStatusHistory.create({ data: { bookingId: id, fromStatus: current.status, toStatus: to, actorId, reason } });
}

const clean = (s: string | null | undefined, max = 500) => s?.trim().slice(0, max) || null;

// ───────────── Client ─────────────

export async function cancelByClient(actor: Actor, bookingId: string, reason: string | null) {
  const b = await loadForClient(actor, bookingId);
  if (!clientActions(b, new Date()).includes("cancel")) throw new BookingBlocked("state");
  await db.$transaction(async (tx) => {
    await move(tx, b.id, ["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED"], "CANCELLED_BY_CLIENT", actor.id, clean(reason), { cancelledAt: new Date(), proposedStartAt: null, proposedEndAt: null });
    await notify(
      tx,
      b.provider.user,
      "booking-cancelled",
      { by: "client", client: clientLabel(b).split(" ")[0], service: b.serviceNameSnap, reference: b.reference, note: clean(reason), at: b.startAt, path: `/dashboard/provider/bookings/${b.id}` },
      `booking:${b.id}:cancelled`,
    );
  });
}

/** The client answers a proposed time. Accepting re-checks capacity under the profile lock. */
export async function answerProposal(actor: Actor, bookingId: string, accept: boolean) {
  const b = await loadForClient(actor, bookingId);
  if (b.status !== "RESCHEDULE_PROPOSED" || !b.proposedStartAt || !b.proposedEndAt) throw new BookingBlocked("state");
  const proposedStart = b.proposedStartAt;
  const proposedEnd = b.proposedEndAt;
  await db.$transaction(async (tx) => {
    if (accept) {
      await tx.$queryRaw`SELECT id FROM "ProviderServiceProfile" WHERE id = ${b.profileId}::uuid FOR UPDATE`;
      if (proposedStart.getTime() <= Date.now()) throw new BookingBlocked("slot");
      await move(tx, b.id, ["RESCHEDULE_PROPOSED"], "ACCEPTED", actor.id, null, { startAt: proposedStart, endAt: proposedEnd, proposedStartAt: null, proposedEndAt: null });
    } else {
      // Back to the state the proposal came from: the original slot was held all along.
      const last = await tx.bookingStatusHistory.findFirst({ where: { bookingId: b.id, toStatus: "RESCHEDULE_PROPOSED" }, orderBy: { createdAt: "desc" }, select: { fromStatus: true } });
      const back: BookingStatus = last?.fromStatus === "PENDING" ? "PENDING" : "ACCEPTED";
      await move(tx, b.id, ["RESCHEDULE_PROPOSED"], back, actor.id, "proposal declined", { proposedStartAt: null, proposedEndAt: null });
    }
    await notify(
      tx,
      b.provider.user,
      "booking-reschedule-reply",
      { outcome: accept ? "approved" : "rejected", client: clientLabel(b).split(" ")[0], service: b.serviceNameSnap, reference: b.reference, at: accept ? proposedStart : b.startAt, path: `/dashboard/provider/bookings/${b.id}` },
      `booking:${b.id}:proposal:${proposedStart.toISOString()}:${accept ? "yes" : "no"}`,
    );
  });
}

export async function leaveReview(actor: Actor, bookingId: string, rating: number, comment: string | null) {
  const b = await loadForClient(actor, bookingId);
  if (!clientActions({ ...b, hasReview: Boolean(b.review) }, new Date()).includes("review")) throw new BookingBlocked("state");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BookingBlocked("state");
  try {
    await db.review.create({ data: { bookingId: b.id, clientId: actor.id, profileId: b.profileId, rating, comment: clean(comment, 1000) } });
  } catch {
    throw new BookingBlocked("state"); // unique bookingId: a second review for the same visit
  }
}

// ───────────── Professional ─────────────

export async function cancelByProvider(actor: Actor, bookingId: string, reason: string | null) {
  const b = await loadForProvider(actor, bookingId);
  if (!providerActions(b, new Date()).includes("cancel")) throw new BookingBlocked("state");
  const why = clean(reason);
  if (!why) throw new BookingBlocked("service"); // a reason is required when the professional cancels
  await db.$transaction(async (tx) => {
    await move(tx, b.id, ["ACCEPTED", "RESCHEDULE_PROPOSED"], "CANCELLED_BY_PROVIDER", actor.id, why, { cancelledAt: new Date(), proposedStartAt: null, proposedEndAt: null });
    await notify(tx, b.client, "booking-cancelled", { by: "provider", service: b.serviceNameSnap, reference: b.reference, note: why, at: b.startAt, path: `/dashboard/client/appointments/${b.id}` }, `booking:${b.id}:cancelled`);
  });
}

/**
 * The professional proposes another start time. The new slot must be free for this service (the
 * booking itself excluded) and is then held next to the original one until the client answers.
 */
export async function proposeTime(actor: Actor, bookingId: string, startAt: string, note: string | null) {
  const b = await loadForProvider(actor, bookingId);
  if (!providerActions(b, new Date()).includes("propose")) throw new BookingBlocked("state");
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime()) || start.getTime() === b.startAt.getTime()) throw new BookingBlocked("slot");
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(start);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ProviderServiceProfile" WHERE id = ${b.profileId}::uuid FOR UPDATE`;
    const [day] = await loadAvailability(tx, b.profileId, { durationMinutes: b.durationMinSnap, bufferMinutes: (b.service?.bufferMinutes ?? 0) }, localDate, 1, b.id);
    if (!day?.slots.some((s) => s.startAt.getTime() === start.getTime())) throw new BookingBlocked("slot");
    const end = new Date(start.getTime() + b.durationMinSnap * 60_000);
    await move(tx, b.id, ["PENDING", "ACCEPTED"], "RESCHEDULE_PROPOSED", actor.id, clean(note), { proposedStartAt: start, proposedEndAt: end, providerNote: clean(note) ?? undefined });
    await notify(tx, b.client, "booking-reschedule", { service: b.serviceNameSnap, reference: b.reference, note: clean(note), at: start, path: `/dashboard/client/appointments/${b.id}` }, `booking:${b.id}:proposal:${start.toISOString()}`);
  });
}

/** After the start time: the visit happened (COMPLETED) or the client did not come (NO_SHOW). */
export async function closeVisit(actor: Actor, bookingId: string, outcome: "COMPLETED" | "NO_SHOW") {
  const b = await loadForProvider(actor, bookingId);
  if (!providerActions(b, new Date()).includes(outcome === "COMPLETED" ? "complete" : "noShow")) throw new BookingBlocked("state");
  await db.$transaction((tx) => move(tx, b.id, ["ACCEPTED"], outcome, actor.id, null, outcome === "COMPLETED" ? { completedAt: new Date() } : {}));
}

/**
 * The professional records money received (or refunded) for a completed visit. This is her own
 * bookkeeping: Woman Cares never takes the payment. A refund cannot exceed what was recorded as paid.
 */
export async function recordVisitPayment(actor: Actor, bookingId: string, input: { amount: number; method: string; refund: boolean; note: string | null }) {
  const b = await loadForProvider(actor, bookingId);
  if (!providerActions(b, new Date()).includes("pay")) throw new BookingBlocked("state");
  if (!PAYMENT_METHODS.includes(input.method as PaymentMethod) || !(input.amount > 0)) throw new BookingBlocked("service");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${b.id}::uuid FOR UPDATE`;
    const rows = await tx.bookingPayment.findMany({ where: { bookingId: b.id }, select: { amount: true, status: true } });
    const before = paymentSummary(rows.map((r) => ({ amount: Number(r.amount), status: r.status })));
    if (input.refund && input.amount > before.net) throw new BookingBlocked("service");
    await tx.bookingPayment.create({ data: { bookingId: b.id, amount: input.amount, status: input.refund ? "REFUNDED" : "PAID", method: input.method, note: clean(input.note), recordedById: actor.id } });
    const after = paymentSummary([...rows.map((r) => ({ amount: Number(r.amount), status: r.status })), { amount: input.amount, status: input.refund ? "REFUNDED" : "PAID" }]);
    await tx.booking.update({ where: { id: b.id }, data: { paymentStatus: after.status } });
  });
}

// ───────────── System ─────────────

/** Requests nobody answered before `pendingExpiresAt` free their place. Idempotent. */
export async function expirePendingBookings(now = new Date()) {
  const due = await db.booking.findMany({ where: { status: "PENDING", pendingExpiresAt: { lte: now } }, take: 500, include: { client: people.client } });
  let expired = 0;
  for (const b of due) {
    try {
      await db.$transaction(async (tx) => {
        await move(tx, b.id, ["PENDING"], "EXPIRED", null, "no answer");
        await notify(tx, b.client, "booking-decision", { outcome: "rejected", service: b.serviceNameSnap, reference: b.reference, note: null, at: b.startAt, path: `/dashboard/client/appointments/${b.id}` }, `booking:${b.id}:EXPIRED`);
      });
      expired++;
    } catch (e) {
      if (!(e instanceof BookingBlocked)) throw e; // answered meanwhile
    }
  }
  return { expired };
}

/** Free start times on one Algiers date for moving this booking (the booking itself excluded). */
export async function freeSlotsForBooking(actor: Actor, bookingId: string, date: string) {
  const b = await loadForProvider(actor, bookingId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const [day] = await loadAvailability(db, b.profileId, { durationMinutes: b.durationMinSnap, bufferMinutes: (b.service?.bufferMinutes ?? 0) }, date, 1, b.id);
  return (day?.slots ?? []).map((s) => s.startAt.toISOString());
}
