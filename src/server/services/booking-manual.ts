import "server-only";
import { db } from "@/lib/db";
import { formatDzd } from "@/lib/format";
import { isLocale } from "@/i18n/config";
import { canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import type { Prisma } from "@/generated/prisma/client";
import { algiersClock } from "@/lib/insights";
import { algiersDate } from "@/lib/periods";
import { ACTIVE_STATUSES, BookingBlocked, newReference, notify, UUID } from "./bookings";

/**
 * The professional's own calendar tools: appointments she adds by hand (a client on the phone, a
 * walk-in, a friend late at night), editing that client's name and phone, moving any live
 * appointment to another day or hour directly, and agreeing a price. Clients with an account are
 * told by email and in-app; every change leaves a history row.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^[+0-9 ().-]{6,24}$/;

/** Algiers wall time (UTC+1, no daylight saving) to an instant. */
export function algiersAt(day: string, time: string) {
  return new Date(`${day}T${time}:00+01:00`);
}

async function account(actor: Actor) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status)) throw new ForbiddenError();
  const a = await db.providerAccount.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!a) throw new ForbiddenError();
  return a;
}

function cleanName(v: string) {
  const name = v.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) throw new BookingBlocked("service");
  return name;
}
function cleanPhone(v: string) {
  const phone = v.trim();
  if (phone && !PHONE.test(phone)) throw new BookingBlocked("service");
  return phone || null;
}

/** Services she can book by hand, grouped by her live profiles. */
export async function listMyServices(actor: Actor) {
  const a = await account(actor);
  return db.providerService.findMany({
    where: { profile: { providerId: a.id, status: { not: "ARCHIVED" } } },
    orderBy: [{ profile: { category: { sortOrder: "asc" } } }, { sortOrder: "asc" }],
    select: { id: true, name: true, durationMinutes: true, active: true, profile: { select: { id: true, slotMinutes: true, category: { select: { slug: true } } } } },
  });
}

/**
 * When the moment falls inside her opening hours, the places of that range (postes) must not all be
 * taken already; outside her hours (an evening for a friend) it is her own time and is not limited.
 */
async function assertPlace(tx: Prisma.TransactionClient, profileId: string, start: Date, end: Date, excludeId?: string) {
  await tx.$queryRaw`SELECT id FROM "ProviderServiceProfile" WHERE id = ${profileId}::uuid FOR UPDATE`;
  const day = algiersDate(start);
  const { weekday, minute } = algiersClock(start);
  const [weekly, exception] = await Promise.all([
    tx.workingSchedule.findMany({ where: { profileId, weekday }, select: { startMinute: true, endMinute: true, capacity: true } }),
    tx.scheduleException.findFirst({ where: { profileId, date: new Date(`${day}T00:00:00Z`) } }),
  ]);
  const windows = exception?.isClosed
    ? []
    : exception && exception.startMinute !== null && exception.endMinute !== null
      ? [{ startMinute: exception.startMinute, endMinute: exception.endMinute, capacity: exception.capacity ?? 1 }]
      : weekly;
  const range = windows.find((w) => minute >= w.startMinute && minute < w.endMinute);
  if (!range) return;
  const taken = await tx.booking.count({
    where: { profileId, status: { in: [...ACTIVE_STATUSES] }, startAt: { lt: end }, endAt: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (taken >= range.capacity) throw new BookingBlocked("full");
}

/**
 * Adds an appointment by hand. The service is one of hers (by id or by the exact name she typed) or
 * any text she writes for this visit; for a typed service the duration she gives is used (60 min by default).
 */
export async function createManualBooking(
  actor: Actor,
  input: { serviceId?: string | null; profileId?: string | null; serviceName?: string | null; day: string; time: string; durationMinutes?: number | null; guestName: string; guestPhone: string; note?: string | null; price?: number | null },
) {
  const a = await account(actor);
  if (!DAY.test(input.day) || !TIME.test(input.time)) throw new BookingBlocked("slot");
  const select = { id: true, name: true, durationMinutes: true, priceMin: true, priceMax: true, profileId: true } as const;
  let service: { id: string; name: string; durationMinutes: number; priceMin: Prisma.Decimal; priceMax: Prisma.Decimal | null; profileId: string } | null = null;
  let profileId: string;
  let label: string;
  if (input.serviceId) {
    if (!UUID.test(input.serviceId)) throw new BookingBlocked("service");
    service = await db.providerService.findFirst({ where: { id: input.serviceId, profile: { providerId: a.id, status: { not: "ARCHIVED" } } }, select });
    if (!service) throw new BookingBlocked("service");
    profileId = service.profileId;
    label = service.name;
  } else {
    if (!input.profileId || !UUID.test(input.profileId)) throw new BookingBlocked("service");
    const profile = await db.providerServiceProfile.findFirst({ where: { id: input.profileId, providerId: a.id, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (!profile) throw new BookingBlocked("service");
    label = (input.serviceName ?? "").trim().replace(/\s+/g, " ");
    if (label.length < 2 || label.length > 120) throw new BookingBlocked("service");
    profileId = profile.id;
    service = await db.providerService.findFirst({ where: { profileId, name: { equals: label, mode: "insensitive" } }, select });
  }
  const duration = input.durationMinutes ?? service?.durationMinutes ?? 60;
  // Up to 12 hours: an evening appointment may run past midnight.
  if (!Number.isInteger(duration) || duration < 10 || duration > 720) throw new BookingBlocked("service");
  const start = algiersAt(input.day, input.time);
  if (Number.isNaN(start.getTime())) throw new BookingBlocked("slot");
  const end = new Date(start.getTime() + duration * 60_000);
  const name = cleanName(input.guestName);
  const phone = cleanPhone(input.guestPhone);
  if (input.price != null && !(input.price > 0 && input.price <= 10_000_000)) throw new BookingBlocked("service");
  return db.$transaction(async (tx) => {
    await assertPlace(tx, profileId, start, end);
    const booking = await tx.booking.create({
      data: {
        reference: newReference(),
        clientId: null,
        guestName: name,
        guestPhone: phone,
        source: "MANUAL",
        providerId: a.id,
        profileId,
        serviceId: service?.id ?? null,
        startAt: start,
        endAt: end,
        requestedStartAt: start,
        status: "ACCEPTED",
        serviceNameSnap: service?.name ?? label,
        durationMinSnap: duration,
        priceMinSnap: service?.priceMin ?? input.price ?? 0,
        priceMaxSnap: service ? service.priceMax : null,
        agreedPrice: input.price ?? null,
        providerNote: input.note?.trim().slice(0, 500) || null,
      },
      select: { id: true, reference: true, startAt: true },
    });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, toStatus: "ACCEPTED", actorId: actor.id, reason: "manual" } });
    return booking;
  });
}

async function ownBooking(actor: Actor, bookingId: string) {
  const a = await account(actor);
  if (!UUID.test(bookingId)) throw new ForbiddenError();
  const b = await db.booking.findFirst({ where: { id: bookingId, providerId: a.id }, include: { client: { select: { id: true, email: true, fullName: true, locale: true } } } });
  if (!b) throw new ForbiddenError();
  return b;
}

/** Name and phone of a client she added by hand, editable at any time. */
export async function updateGuest(actor: Actor, bookingId: string, input: { guestName: string; guestPhone: string }) {
  const b = await ownBooking(actor, bookingId);
  if (b.source !== "MANUAL") throw new BookingBlocked("state");
  await db.booking.update({ where: { id: b.id }, data: { guestName: cleanName(input.guestName), guestPhone: cleanPhone(input.guestPhone) } });
}

const LIVE = ["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED"] as const;

/**
 * Moves a live appointment to any day and hour (another day, week or month), directly. The client is
 * told; a pending proposal is dropped. She remains responsible for not double-booking herself.
 */
export async function moveBooking(actor: Actor, bookingId: string, input: { day: string; time: string; durationMinutes?: number | null; note?: string | null }) {
  const b = await ownBooking(actor, bookingId);
  if (!(LIVE as readonly string[]).includes(b.status)) throw new BookingBlocked("state");
  if (!DAY.test(input.day) || !TIME.test(input.time)) throw new BookingBlocked("slot");
  const start = algiersAt(input.day, input.time);
  if (start.getTime() < Date.now() - 60 * 60_000) throw new BookingBlocked("slot"); // not in the past
  const duration = input.durationMinutes ?? b.durationMinSnap;
  if (!Number.isInteger(duration) || duration < 10 || duration > 720) throw new BookingBlocked("service");
  const note = input.note?.trim().slice(0, 500) || null;
  await db.$transaction(async (tx) => {
    await assertPlace(tx, b.profileId, start, new Date(start.getTime() + duration * 60_000), b.id);
    const status = b.status === "RESCHEDULE_PROPOSED" ? "ACCEPTED" : b.status;
    const updated = await tx.booking.updateMany({
      where: { id: b.id, status: b.status },
      data: { startAt: start, endAt: new Date(start.getTime() + duration * 60_000), durationMinSnap: duration, proposedStartAt: null, proposedEndAt: null, status, ...(note ? { providerNote: note } : {}) },
    });
    if (updated.count !== 1) throw new BookingBlocked("state");
    await tx.bookingStatusHistory.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: status, actorId: actor.id, reason: `moved ${b.startAt.toISOString()} → ${start.toISOString()}${note ? ` · ${note}` : ""}` } });
    await notify(tx, b.client, "booking-updated", { service: b.serviceNameSnap, reference: b.reference, note, at: start, path: `/dashboard/client/appointments/${b.id}` }, `booking:${b.id}:moved:${start.toISOString()}`);
  });
}

/** The price agreed with the client (null clears it). The client with an account is told. */
export async function setAgreedPrice(actor: Actor, bookingId: string, price: number | null, note?: string | null) {
  const b = await ownBooking(actor, bookingId);
  if (b.status === "REJECTED" || b.status === "EXPIRED" || b.status === "CANCELLED_BY_CLIENT" || b.status === "CANCELLED_BY_PROVIDER") throw new BookingBlocked("state");
  if (price !== null && !(price > 0 && price <= 10_000_000)) throw new BookingBlocked("service");
  const clean = note?.trim().slice(0, 500) || null;
  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: b.id }, data: { agreedPrice: price } });
    await tx.bookingStatusHistory.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: b.status, actorId: actor.id, reason: `price ${price ?? "-"}${clean ? ` · ${clean}` : ""}` } });
    if (price !== null && b.client) {
      const locale = isLocale(b.client.locale) ? b.client.locale : "fr";
      await notify(tx, b.client, "booking-updated", { service: b.serviceNameSnap, reference: b.reference, amount: formatDzd(String(price), locale), note: clean, at: b.startAt, path: `/dashboard/client/appointments/${b.id}` }, `booking:${b.id}:price:${price}`);
    }
  });
}

const CLOSED = ["REJECTED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "EXPIRED"] as const;

/** Whether she may delete this booking: one she added by hand (any time), or an online one that is over. */
export function canDeleteBooking(b: { source: string; status: string }) {
  return b.source === "MANUAL" || (CLOSED as readonly string[]).includes(b.status);
}

/**
 * Deletes a booking from her agenda for good, with its history and recorded payments. A live online
 * request must first be refused or cancelled, so the client is always told.
 */
export async function deleteBooking(actor: Actor, bookingId: string) {
  const b = await ownBooking(actor, bookingId);
  if (!canDeleteBooking(b)) throw new BookingBlocked("state");
  await db.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { bookingId: b.id }, select: { id: true } });
    if (review) {
      await tx.reviewReport.deleteMany({ where: { reviewId: review.id } });
      await tx.review.delete({ where: { id: review.id } });
    }
    await tx.bookingPayment.deleteMany({ where: { bookingId: b.id } });
    await tx.bookingReferenceMedia.deleteMany({ where: { bookingId: b.id } });
    await tx.bookingStatusHistory.deleteMany({ where: { bookingId: b.id } });
    await tx.booking.delete({ where: { id: b.id } });
  });
}
