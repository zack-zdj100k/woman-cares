import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { isLocale, type Locale } from "@/i18n/config";
import { addDays, computeDays, MAX_HORIZON_DAYS, type Day } from "@/lib/availability";
import { formatDate } from "@/lib/format";
import { renderEmail, type EmailTemplate, type TemplateData } from "@/lib/email/templates";
import { canRequestAppointment, canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { publicProfileWhere } from "./discovery";
import { enqueueEmail } from "./outbox";

/** Statuses that hold a place in the provider's capacity. */
export const ACTIVE_STATUSES = ["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED"] as const;
export const MAX_OPEN_REQUESTS = 5;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The request cannot be made (the reason says why; the UI maps it to a message). */
export class BookingBlocked extends Error {
  constructor(public reason: "slot" | "limit" | "profile" | "service" | "state" | "role" | "full") {
    super(reason);
  }
}

export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
}

/**
 * Free start times for a service. Busy time is every active booking's slot plus, for bookings
 * waiting on a reschedule answer, the proposed slot too (both stay held until the client decides).
 * `excludeBookingId` ignores one booking, so moving an appointment never collides with itself.
 */
export async function loadAvailability(
  tx: Prisma.TransactionClient,
  profileId: string,
  service: { durationMinutes: number; bufferMinutes: number },
  from: string,
  days: number,
  excludeBookingId?: string,
) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const rangeStart = new Date(`${dates[0]}T00:00:00Z`);
  const rangeEnd = new Date(`${addDays(dates[dates.length - 1], 1)}T00:00:00Z`);
  const [profileRow, windows, exceptions, busy] = await Promise.all([
    tx.providerServiceProfile.findUnique({ where: { id: profileId }, select: { slotMinutes: true } }),
    tx.workingSchedule.findMany({ where: { profileId }, select: { weekday: true, startMinute: true, endMinute: true, capacity: true } }),
    tx.scheduleException.findMany({ where: { profileId, date: { gte: rangeStart, lt: rangeEnd } } }),
    tx.booking.findMany({
      where: {
        profileId,
        status: { in: [...ACTIVE_STATUSES] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        OR: [
          { startAt: { lt: new Date(rangeEnd.getTime() + 86_400_000) }, endAt: { gt: new Date(rangeStart.getTime() - 86_400_000) } },
          { proposedStartAt: { lt: new Date(rangeEnd.getTime() + 86_400_000) }, proposedEndAt: { gt: new Date(rangeStart.getTime() - 86_400_000) } },
        ],
      },
      select: { startAt: true, endAt: true, proposedStartAt: true, proposedEndAt: true, service: { select: { bufferMinutes: true } } },
    }),
  ]);
  const held = busy.flatMap((b) => [
    { startAt: b.startAt, endAt: b.endAt, bufferMinutes: (b.service?.bufferMinutes ?? 0) },
    ...(b.proposedStartAt && b.proposedEndAt ? [{ startAt: b.proposedStartAt, endAt: b.proposedEndAt, bufferMinutes: (b.service?.bufferMinutes ?? 0) }] : []),
  ]);
  return computeDays({
    dates,
    windows,
    exceptions: exceptions.map((e) => ({ date: e.date.toISOString().slice(0, 10), isClosed: e.isClosed, startMinute: e.startMinute, endMinute: e.endMinute, capacity: e.capacity })),
    busy: held,
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    now: new Date(),
    stepMinutes: profileRow?.slotMinutes,
  });
}

/** Public: free start times for one service of a visible profile, over up to 14 days. */
export async function getAvailability(profileSlug: string, serviceId: string, from: string | undefined, days = 14): Promise<Day[] | null> {
  if (!UUID.test(serviceId)) return null;
  const profile = await db.providerServiceProfile.findFirst({ where: { ...publicProfileWhere, slug: profileSlug }, select: { id: true } });
  if (!profile) return null;
  const service = await db.providerService.findFirst({ where: { id: serviceId, profileId: profile.id, active: true }, select: { durationMinutes: true, bufferMinutes: true } });
  if (!service) return null;
  const start = from && DATE.test(from) && from >= today() ? from : today();
  if (start > addDays(today(), MAX_HORIZON_DAYS)) return [];
  const span = Math.max(1, Math.min(14, days, 1 + (Date.parse(addDays(today(), MAX_HORIZON_DAYS)) - Date.parse(start)) / 86_400_000));
  return loadAvailability(db, profile.id, service, start, span);
}

export function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `WC-${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("")}`;
}

function localeOf(l: string): Locale {
  return isLocale(l) ? l : "fr";
}

export async function notify(
  tx: Prisma.TransactionClient,
  /** Null for a client added by hand (no account): nobody to notify. */
  user: { id: string; email: string; fullName: string; locale: string } | null,
  template: EmailTemplate,
  data: Omit<TemplateData, "name" | "url" | "when"> & { at: Date; path: string },
  dedupeKey: string,
) {
  if (!user) return;
  const locale = localeOf(user.locale);
  const full: TemplateData = {
    ...data,
    name: user.fullName.split(" ")[0],
    when: formatDate(data.at, locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    url: `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/${locale}${data.path}`,
  };
  const rendered = renderEmail(template, locale, full);
  await tx.notification.create({ data: { userId: user.id, type: `booking.${template}`, title: rendered.subject, body: rendered.text.split("\n").filter(Boolean)[1] ?? rendered.subject } });
  await enqueueEmail(tx, { to: user.email, template, locale, data: full, dedupeKey });
}

/**
 * A client asks for a time. The profile row is locked for the transaction, availability is
 * recomputed with the latest bookings, and the request takes one place of capacity (PENDING).
 * Repeating the same idempotency key returns the first request instead of creating another.
 */
export async function requestBooking(
  actor: Actor,
  input: { profileSlug: string; serviceId: string; startAt: string; note: string | null; idempotencyKey: string },
) {
  if (!canRequestAppointment(actor)) throw new BookingBlocked("role");
  if (!UUID.test(input.serviceId) || !UUID.test(input.idempotencyKey)) throw new BookingBlocked("service");
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) throw new BookingBlocked("slot");

  const existing = await db.booking.findUnique({ where: { idempotencyKey: `${actor.id}:${input.idempotencyKey}` }, select: { id: true, reference: true, clientId: true } });
  if (existing && existing.clientId === actor.id) return { id: existing.id, reference: existing.reference };

  const profile = await db.providerServiceProfile.findFirst({
    where: { ...publicProfileWhere, slug: input.profileSlug },
    select: { id: true, slug: true, providerId: true, provider: { select: { userId: true, user: { select: { id: true, email: true, fullName: true, locale: true } } } } },
  });
  if (!profile) throw new BookingBlocked("profile");
  if (profile.provider.userId === actor.id) throw new BookingBlocked("role");
  const service = await db.providerService.findFirst({ where: { id: input.serviceId, profileId: profile.id, active: true } });
  if (!service) throw new BookingBlocked("service");
  const open = await db.booking.count({ where: { clientId: actor.id, status: { in: ["PENDING", "RESCHEDULE_PROPOSED"] } } });
  if (open >= MAX_OPEN_REQUESTS) throw new BookingBlocked("limit");

  const client = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { id: true, email: true, fullName: true, locale: true } });
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(start);

  return db.$transaction(async (tx) => {
    // Serialise requests on this profile: concurrent attempts wait here, then see each other's rows.
    await tx.$queryRaw`SELECT id FROM "ProviderServiceProfile" WHERE id = ${profile.id}::uuid FOR UPDATE`;
    const [day] = await loadAvailability(tx, profile.id, service, localDate, 1);
    if (!day?.slots.some((s) => s.startAt.getTime() === start.getTime())) throw new BookingBlocked("slot");

    const end = new Date(start.getTime() + service.durationMinutes * 60_000);
    const booking = await tx.booking.create({
      data: {
        reference: newReference(),
        clientId: actor.id,
        providerId: profile.providerId,
        profileId: profile.id,
        serviceId: service.id,
        startAt: start,
        endAt: end,
        requestedStartAt: start,
        status: "PENDING",
        serviceNameSnap: service.name,
        durationMinSnap: service.durationMinutes,
        priceMinSnap: service.priceMin,
        priceMaxSnap: service.priceMax,
        clientNote: input.note?.trim().slice(0, 500) || null,
        idempotencyKey: `${actor.id}:${input.idempotencyKey}`,
        pendingExpiresAt: new Date(Math.min(start.getTime(), Date.now() + 48 * 3_600_000)),
      },
    });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, toStatus: "PENDING", actorId: actor.id } });
    await notify(tx, profile.provider.user, "booking-request", { service: service.name, reference: booking.reference, client: client.fullName.split(" ")[0], at: start, path: `/dashboard/provider/bookings/${booking.id}` }, `booking:${booking.id}:request`);
    await notify(tx, client, "booking-received", { service: service.name, reference: booking.reference, at: start, path: "/dashboard/client/appointments" }, `booking:${booking.id}:received`);
    return { id: booking.id, reference: booking.reference };
  });
}

/** The provider accepts or declines a pending request; the client is told in her language. */
export async function respondToBooking(actor: Actor, bookingId: string, accept: boolean, note: string | null) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status) || !UUID.test(bookingId)) throw new ForbiddenError();
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { provider: { select: { userId: true } }, client: { select: { id: true, email: true, fullName: true, locale: true } } },
  });
  if (!booking || booking.provider.userId !== actor.id) throw new ForbiddenError();
  if (booking.status !== "PENDING") throw new BookingBlocked("state");
  const status = accept ? "ACCEPTED" : "REJECTED";
  await db.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({ where: { id: booking.id, status: "PENDING" }, data: { status, providerNote: note?.trim().slice(0, 500) || null } });
    if (updated.count !== 1) throw new BookingBlocked("state");
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, fromStatus: "PENDING", toStatus: status, actorId: actor.id, reason: note?.trim() || null } });
    await notify(
      tx,
      booking.client,
      "booking-decision",
      { service: booking.serviceNameSnap, reference: booking.reference, outcome: accept ? "approved" : "rejected", note: note?.trim() || null, at: booking.startAt, path: "/dashboard/client/appointments" },
      `booking:${booking.id}:${status}`,
    );
  });
}

const bookingSelect = {
  id: true,
  reference: true,
  startAt: true,
  status: true,
  serviceNameSnap: true,
  durationMinSnap: true,
  priceMinSnap: true,
  priceMaxSnap: true,
  clientNote: true,
  providerNote: true,
  profile: { select: { slug: true, category: { select: { slug: true } }, provider: { select: { businessName: true } } } },
} as const;

/** The provider's requests and upcoming appointments, newest first. */
export async function listProviderBookings(actor: Actor) {
  if (actor.role !== "PROVIDER") throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!account) throw new ForbiddenError();
  return db.booking.findMany({
    where: { providerId: account.id, OR: [{ status: "PENDING" }, { status: "ACCEPTED", startAt: { gte: new Date(Date.now() - 86_400_000) } }] },
    orderBy: { startAt: "asc" },
    take: 100,
    select: { ...bookingSelect, client: { select: { fullName: true, phone: true } } },
  });
}

/** The client's own requests and appointments. */
export type ClientBookingFilter = "upcoming" | "pending" | "past" | "all";

export async function listClientBookings(actor: Actor, filter: ClientBookingFilter = "all", page = 1) {
  if (actor.role !== "CLIENT") throw new ForbiddenError();
  const now = new Date();
  const where: Prisma.BookingWhereInput =
    filter === "upcoming"
      ? { clientId: actor.id, status: { in: ["ACCEPTED", "RESCHEDULE_PROPOSED"] }, startAt: { gte: now } }
      : filter === "pending"
        ? { clientId: actor.id, status: "PENDING" }
        : filter === "past"
          ? { clientId: actor.id, OR: [{ startAt: { lt: now } }, { status: { in: ["COMPLETED", "NO_SHOW", "REJECTED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "EXPIRED"] } }] }
          : { clientId: actor.id };
  const [total, rows] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: { startAt: filter === "upcoming" || filter === "pending" ? "asc" : "desc" },
      take: 20,
      skip: (page - 1) * 20,
      select: { ...bookingSelect, paymentStatus: true, proposedStartAt: true, review: { select: { id: true } } },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / 20)) };
}
