import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { UUID } from "./bookings";

/** Read models for the booking tables and detail pages. Ownership is part of every query. */

const PAGE = 20;
const CLOSED = ["COMPLETED", "NO_SHOW", "REJECTED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "EXPIRED"] as const;

const row = {
  id: true,
  reference: true,
  startAt: true,
  endAt: true,
  proposedStartAt: true,
  status: true,
  paymentStatus: true,
  serviceNameSnap: true,
  durationMinSnap: true,
  priceMinSnap: true,
  priceMaxSnap: true,
  agreedPrice: true,
  source: true,
  profile: { select: { slug: true, category: { select: { slug: true } }, provider: { select: { businessName: true } } } },
} as const;

const detail = {
  ...row,
  guestName: true,
  guestPhone: true,
  clientId: true,
  requestedStartAt: true,
  proposedEndAt: true,
  clientNote: true,
  providerNote: true,
  createdAt: true,
  cancelledAt: true,
  completedAt: true,
  history: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true, actorId: true } },
} as const;

export type ProviderBookingFilter = "all" | "today" | "upcoming" | "past" | "cancelled";

async function providerAccount(actor: Actor) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!account) throw new ForbiddenError();
  return account;
}

function algiersDayRange(now: Date) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(now);
  const from = new Date(`${day}T00:00:00+01:00`);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/** The professional's operational table: filter, category, search by reference or client, paging. */
export async function listProviderBookingTable(actor: Actor, opts: { filter: ProviderBookingFilter; category?: string; q?: string; page: number }) {
  const account = await providerAccount(actor);
  const now = new Date();
  const base: Prisma.BookingWhereInput = { providerId: account.id, ...(opts.category ? { profile: { category: { slug: opts.category } } } : {}) };
  const q = opts.q?.trim().slice(0, 80);
  const search: Prisma.BookingWhereInput = q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }, { client: { fullName: { contains: q, mode: "insensitive" } } }] } : {};
  const today = algiersDayRange(now);
  const byFilter: Record<ProviderBookingFilter, Prisma.BookingWhereInput> = {
    // Requests to answer, proposals waiting and confirmed appointments still to come.
    upcoming: { status: { in: ["PENDING", "RESCHEDULE_PROPOSED", "ACCEPTED"] }, startAt: { gte: now } },
    today: { status: { in: ["ACCEPTED", "COMPLETED", "NO_SHOW", "RESCHEDULE_PROPOSED", "PENDING"] }, startAt: { gte: today.from, lt: today.to } },
    past: { OR: [{ status: { in: ["COMPLETED", "NO_SHOW"] } }, { status: "ACCEPTED", startAt: { lt: now } }] },
    cancelled: { status: { in: ["REJECTED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER", "EXPIRED"] } },
    all: {},
  };
  const where: Prisma.BookingWhereInput = { AND: [base, search, byFilter[opts.filter]] };
  const ascending = opts.filter === "upcoming" || opts.filter === "today";
  const [total, rows, counts, pendingCount] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({ where, orderBy: { startAt: ascending ? "asc" : "desc" }, take: PAGE, skip: (Math.max(1, opts.page) - 1) * PAGE, select: { ...row, client: { select: { fullName: true } }, guestName: true } }),
    Promise.all((["upcoming", "today", "past"] as const).map((f) => db.booking.count({ where: { AND: [base, byFilter[f]] } }))),
    db.booking.count({ where: { ...base, status: "PENDING" } }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / PAGE)), counts: { upcoming: counts[0], today: counts[1], past: counts[2] }, pending: pendingCount };
}

/** One booking for its professional: history, payments, and the client's contact while it is live. */
export async function getProviderBooking(actor: Actor, bookingId: string) {
  const account = await providerAccount(actor);
  if (!UUID.test(bookingId)) return null;
  const b = await db.booking.findFirst({
    where: { id: bookingId, providerId: account.id },
    select: {
      ...detail,
      client: { select: { fullName: true, phone: true } },
      payments: { orderBy: { recordedAt: "asc" }, select: { id: true, amount: true, status: true, method: true, note: true, recordedAt: true } },
      review: { select: { rating: true, comment: true, status: true } },
    },
  });
  if (!b) return null;
  // Phone only while there is an appointment to honour (or one just held).
  const showPhone = b.source === "MANUAL" || ["ACCEPTED", "RESCHEDULE_PROPOSED", "COMPLETED"].includes(b.status);
  return { ...b, client: { fullName: b.client?.fullName ?? b.guestName ?? "-", phone: showPhone ? (b.client?.phone ?? b.guestPhone) : null } };
}

export async function getClientBooking(actor: Actor, bookingId: string) {
  if (actor.role !== "CLIENT" || !UUID.test(bookingId)) throw new ForbiddenError();
  return db.booking.findFirst({ where: { id: bookingId, clientId: actor.id }, select: { ...detail, review: { select: { rating: true, comment: true, status: true } } } });
}

export { CLOSED as CLOSED_STATUSES };

/** The professional's categories (live profiles), for the category switcher. */
export async function providerCategories(actor: Actor) {
  const account = await providerAccount(actor);
  const profiles = await db.providerServiceProfile.findMany({ where: { providerId: account.id, status: { not: "ARCHIVED" } }, orderBy: { category: { sortOrder: "asc" } }, select: { category: { select: { slug: true } } } });
  return profiles.map((p) => p.category.slug);
}
