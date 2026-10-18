import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { algiersDate, lastWeeks, periodRange, type PeriodKey } from "@/lib/periods";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";

/**
 * The professional's overview, for all categories or one (category switcher). Definitions:
 * docs/DASHBOARD_SPECIFICATION.md › Financial definitions. Every number is scoped to profiles the
 * signed-in professional owns; the category comes from the URL but is matched against her profiles.
 */
export async function getProviderOverview(actor: Actor, opts: { category?: string; period: PeriodKey }) {
  if (actor.role !== "PROVIDER") throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({
    where: { userId: actor.id },
    select: {
      id: true,
      businessName: true,
      status: true,
      categoryRequests: { where: { status: "PENDING" }, select: { category: { select: { slug: true } } } },
      profiles: { where: { status: { not: "ARCHIVED" } }, select: { id: true, slug: true, status: true, category: { select: { slug: true, sortOrder: true } } }, orderBy: { category: { sortOrder: "asc" } } },
    },
  });
  if (!account) throw new ForbiddenError();
  const selected = opts.category ? account.profiles.filter((p) => p.category.slug === opts.category) : account.profiles;
  const ids = selected.map((p) => p.id);
  const scope: Prisma.BookingWhereInput = { providerId: account.id, profileId: { in: ids } };
  const { from, prevFrom, to } = periodRange(opts.period);
  const weeks = lastWeeks(8);
  const none = ids.length === 0;

  const [bookings, prevBookings, pending, upcoming, completed, everAccepted, cancelled, paid, refunded, views, prevViews, requests, nextAppointments, activity, subscription] = await Promise.all([
    db.booking.count({ where: { ...scope, startAt: { gte: from, lt: to } } }),
    db.booking.count({ where: { ...scope, startAt: { gte: prevFrom, lt: from } } }),
    db.booking.count({ where: { ...scope, status: "PENDING" } }),
    db.booking.count({ where: { ...scope, status: "ACCEPTED", startAt: { gte: new Date() } } }),
    db.booking.count({ where: { ...scope, status: "COMPLETED", startAt: { gte: from, lt: to } } }),
    db.booking.count({ where: { ...scope, startAt: { gte: from, lt: to }, history: { some: { toStatus: "ACCEPTED" } } } }),
    db.booking.count({ where: { ...scope, startAt: { gte: from, lt: to }, status: { in: ["CANCELLED_BY_CLIENT", "CANCELLED_BY_PROVIDER"] }, history: { some: { toStatus: "ACCEPTED" } } } }),
    db.bookingPayment.aggregate({ where: { booking: scope, status: "PAID", recordedAt: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.bookingPayment.aggregate({ where: { booking: scope, status: "REFUNDED", recordedAt: { gte: from, lt: to } }, _sum: { amount: true } }),
    db.profileViewEvent.count({ where: { profileId: { in: ids }, day: { gte: new Date(`${algiersDate(from)}T00:00:00Z`), lte: new Date(`${algiersDate(to)}T00:00:00Z`) } } }),
    db.profileViewEvent.count({ where: { profileId: { in: ids }, day: { gte: new Date(`${algiersDate(prevFrom)}T00:00:00Z`), lt: new Date(`${algiersDate(from)}T00:00:00Z`) } } }),
    db.booking.count({ where: { ...scope, createdAt: { gte: from, lt: to } } }),
    db.booking.findMany({
      where: { ...scope, status: "ACCEPTED", startAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      take: 5,
      select: { id: true, startAt: true, serviceNameSnap: true, client: { select: { fullName: true } }, guestName: true, profile: { select: { category: { select: { slug: true } } } } },
    }),
    db.bookingStatusHistory.findMany({
      where: { booking: scope },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, toStatus: true, createdAt: true, booking: { select: { serviceNameSnap: true, client: { select: { fullName: true } }, guestName: true } } },
    }),
    db.providerSubscription.findFirst({ where: { providerId: account.id }, orderBy: { createdAt: "desc" }, select: { status: true, trialEndsAt: true, billingBasis: true } }),
  ]);

  // Weekly series: requests created and profile views, Algiers weeks starting Saturday.
  const idList = none ? Prisma.sql`NULL` : Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  const [reqWk, viewWk] = none
    ? [[], []]
    : await Promise.all([
        db.$queryRaw<{ wk: string; n: bigint }[]>`
          SELECT to_char(date_trunc('week', ("createdAt" AT TIME ZONE 'Africa/Algiers') + interval '2 days') - interval '2 days', 'YYYY-MM-DD') AS wk, count(*) AS n
          FROM "Booking" WHERE "profileId" IN (${idList}) AND "createdAt" >= ${weeks[0].start} GROUP BY 1`,
        db.$queryRaw<{ wk: string; n: bigint }[]>`
          SELECT to_char(date_trunc('week', "day" + interval '2 days') - interval '2 days', 'YYYY-MM-DD') AS wk, count(*) AS n
          FROM "ProfileViewEvent" WHERE "profileId" IN (${idList}) AND "day" >= ${new Date(`${weeks[0].date}T00:00:00Z`)} GROUP BY 1`,
      ]);
  const reqMap = new Map(reqWk.map((r) => [r.wk, Number(r.n)]));
  const viewMap = new Map(viewWk.map((r) => [r.wk, Number(r.n)]));

  const revenue = Number(paid._sum.amount ?? 0) - Number(refunded._sum.amount ?? 0);
  return {
    account: { businessName: account.businessName, status: account.status },
    profiles: account.profiles.map((p) => ({ slug: p.slug, category: p.category.slug, status: p.status })),
    pendingCategories: account.categoryRequests.map((r) => r.category.slug),
    category: selected.length && opts.category ? opts.category : null,
    stats: {
      bookings,
      bookingsDelta: bookings - prevBookings,
      pending,
      upcoming,
      completed,
      cancellationRate: everAccepted ? cancelled / everAccepted : null,
      revenue,
      views,
      viewsDelta: views - prevViews,
      conversion: views ? requests / views : null,
    },
    series: weeks.map((w) => ({ week: w.date, requests: reqMap.get(w.date) ?? 0, views: viewMap.get(w.date) ?? 0 })),
    nextAppointments,
    activity,
    subscription,
  };
}
