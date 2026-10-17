import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { hourHistogram, lastMonths, rate, weekdayHistogram } from "@/lib/insights";
import { algiersDate, algiersMidnight, lastWeeks, periodRange, weekStart, type PeriodKey } from "@/lib/periods";
import { canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";

/**
 * The professional's calendar, earnings and analytics. Definitions: docs/DATA_MAPPING.md. Every
 * query is scoped to profiles she owns; the category from the URL is matched against them.
 */

async function scope(actor: Actor, category?: string) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({
    where: { userId: actor.id },
    select: { id: true, profiles: { where: { status: { not: "ARCHIVED" } }, orderBy: { category: { sortOrder: "asc" } }, select: { id: true, category: { select: { slug: true } } } } },
  });
  if (!account) throw new ForbiddenError();
  const categories = account.profiles.map((p) => p.category.slug);
  const active = category && categories.includes(category) ? category : null;
  const profiles = active ? account.profiles.filter((p) => p.category.slug === active) : account.profiles;
  const ids = profiles.map((p) => p.id);
  return { accountId: account.id, categories, active, ids, all: account.profiles, where: { providerId: account.id, profileId: { in: ids } } satisfies Prisma.BookingWhereInput };
}

const DAY = 86_400_000;

// ───────────── Calendar ─────────────

/** One Algiers week (Saturday to Friday): appointments, opening hours and closures. */
export async function getProviderWeek(actor: Actor, opts: { week?: string; category?: string }) {
  const s = await scope(actor, opts.category);
  const first = weekStart(opts.week && /^\d{4}-\d{2}-\d{2}$/.test(opts.week) ? opts.week : algiersDate(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${first}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10));
  const from = algiersMidnight(days[0]);
  const to = algiersMidnight(new Date(Date.parse(`${days[6]}T00:00:00Z`) + DAY).toISOString().slice(0, 10));
  const [bookings, windows, closures] = await Promise.all([
    db.booking.findMany({
      where: { ...s.where, status: { in: ["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED", "COMPLETED", "NO_SHOW"] }, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: "asc" },
      take: 500,
      select: { id: true, startAt: true, endAt: true, status: true, serviceNameSnap: true, client: { select: { fullName: true } }, profile: { select: { category: { select: { slug: true } } } } },
    }),
    db.workingSchedule.findMany({ where: { profileId: { in: s.ids } }, select: { weekday: true, startMinute: true, endMinute: true } }),
    db.scheduleException.findMany({
      where: { profileId: { in: s.ids }, date: { gte: new Date(`${days[0]}T00:00:00Z`), lte: new Date(`${days[6]}T00:00:00Z`) } },
      select: { date: true, isClosed: true, startMinute: true, endMinute: true, note: true, profile: { select: { category: { select: { slug: true } } } } },
    }),
  ]);
  return { categories: s.categories, active: s.active, days, previous: addDaysIso(first, -7), next: addDaysIso(first, 7), bookings, windows, closures };
}

function addDaysIso(date: string, n: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

// ───────────── Earnings ─────────────

/**
 * Money the professional recorded as received from clients (her own bookkeeping: Woman Cares never
 * collects visit payments). Net = paid minus refunded, dated by when each payment was recorded.
 */
export async function getProviderEarnings(actor: Actor, opts: { category?: string; period: PeriodKey }) {
  const s = await scope(actor, opts.category);
  const { from, prevFrom, to } = periodRange(opts.period);
  const pay = (gte: Date, lt: Date): Prisma.BookingPaymentWhereInput => ({ booking: s.where, recordedAt: { gte, lt } });
  const months = lastMonths(12);
  const none = s.ids.length === 0;
  const idList = none ? Prisma.sql`NULL` : Prisma.join(s.ids.map((id) => Prisma.sql`${id}::uuid`));

  const [byStatus, prevByStatus, byMethod, byProfile, unpaid, recent, monthly] = await Promise.all([
    db.bookingPayment.groupBy({ by: ["status"], where: pay(from, to), _sum: { amount: true }, _count: { _all: true } }),
    db.bookingPayment.groupBy({ by: ["status"], where: pay(prevFrom, from), _sum: { amount: true } }),
    db.bookingPayment.groupBy({ by: ["method", "status"], where: pay(from, to), _sum: { amount: true } }),
    none
      ? Promise.resolve([] as { profileId: string; status: string; total: Prisma.Decimal | null }[])
      : db.$queryRaw<{ profileId: string; status: string; total: Prisma.Decimal | null }[]>`
          SELECT b."profileId" AS "profileId", p.status::text AS status, sum(p.amount) AS total
          FROM "BookingPayment" p JOIN "Booking" b ON b.id = p."bookingId"
          WHERE b."profileId" IN (${idList}) AND p."recordedAt" >= ${from} AND p."recordedAt" < ${to}
          GROUP BY 1, 2`,
    db.booking.findMany({
      where: { ...s.where, status: "COMPLETED", paymentStatus: "UNPAID" },
      orderBy: { startAt: "desc" },
      take: 10,
      select: { id: true, reference: true, startAt: true, serviceNameSnap: true, priceMinSnap: true, priceMaxSnap: true, client: { select: { fullName: true } } },
    }),
    db.bookingPayment.findMany({
      where: { booking: s.where },
      orderBy: { recordedAt: "desc" },
      take: 15,
      select: { id: true, amount: true, status: true, method: true, recordedAt: true, booking: { select: { id: true, reference: true, serviceNameSnap: true, client: { select: { fullName: true } }, profile: { select: { category: { select: { slug: true } } } } } } },
    }),
    none
      ? Promise.resolve([] as { month: string; paid: Prisma.Decimal | null; refunded: Prisma.Decimal | null }[])
      : db.$queryRaw<{ month: string; paid: Prisma.Decimal | null; refunded: Prisma.Decimal | null }[]>`
          SELECT to_char(p."recordedAt" AT TIME ZONE 'Africa/Algiers', 'YYYY-MM') AS month,
                 sum(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END) AS paid,
                 sum(CASE WHEN p.status = 'REFUNDED' THEN p.amount ELSE 0 END) AS refunded
          FROM "BookingPayment" p JOIN "Booking" b ON b.id = p."bookingId"
          WHERE b."profileId" IN (${idList}) AND p."recordedAt" >= ${algiersMidnight(`${months[0]}-01`)}
          GROUP BY 1`,
  ]);

  const unpaidCount = await db.booking.count({ where: { ...s.where, status: "COMPLETED", paymentStatus: "UNPAID" } });
  const sum = (rows: { status: string; _sum: { amount: Prisma.Decimal | null } }[], status: string) => Number(rows.find((r) => r.status === status)?._sum.amount ?? 0);
  const paid = sum(byStatus, "PAID");
  const refunded = sum(byStatus, "REFUNDED");
  const net = paid - refunded;
  const prevNet = sum(prevByStatus, "PAID") - sum(prevByStatus, "REFUNDED");
  const paidCount = byStatus.find((r) => r.status === "PAID")?._count._all ?? 0;

  const methods = new Map<string, number>();
  for (const r of byMethod) methods.set(r.method ?? "other", (methods.get(r.method ?? "other") ?? 0) + (r.status === "REFUNDED" ? -1 : 1) * Number(r._sum.amount ?? 0));
  const slugOf = new Map(s.all.map((p) => [p.id, p.category.slug]));
  const categories = new Map<string, number>();
  for (const r of byProfile) {
    const slug = slugOf.get(r.profileId) ?? "?";
    categories.set(slug, (categories.get(slug) ?? 0) + (r.status === "REFUNDED" ? -1 : 1) * Number(r.total ?? 0));
  }
  const monthMap = new Map(monthly.map((m) => [m.month, Number(m.paid ?? 0) - Number(m.refunded ?? 0)]));

  return {
    categories: s.categories,
    active: s.active,
    stats: { paid, refunded, net, netDelta: net - prevNet, paidCount, average: paidCount ? paid / paidCount : null, unpaid: unpaidCount },
    series: months.map((m) => ({ month: m, net: monthMap.get(m) ?? 0 })),
    byMethod: [...methods].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    byCategory: [...categories].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    unpaid,
    recent,
  };
}

// ───────────── Analytics ─────────────

/**
 * Funnel and behaviour figures for a period: views, requests, answers, outcomes, popular services and
 * busy times. Rates are null when there is not enough data (no invented zeros or percentages).
 */
export async function getProviderAnalytics(actor: Actor, opts: { category?: string; period: PeriodKey }) {
  const s = await scope(actor, opts.category);
  const { from, to } = periodRange(opts.period);
  const inPeriod = { ...s.where, createdAt: { gte: from, lt: to } } satisfies Prisma.BookingWhereInput;
  const visits = { ...s.where, startAt: { gte: from, lt: to } } satisfies Prisma.BookingWhereInput;
  const viewDay = { gte: new Date(`${algiersDate(from)}T00:00:00Z`), lte: new Date(`${algiersDate(to)}T00:00:00Z`) };
  const weeks = lastWeeks(12);
  const none = s.ids.length === 0;
  const idList = none ? Prisma.sql`NULL` : Prisma.join(s.ids.map((id) => Prisma.sql`${id}::uuid`));

  const [views, requestStatuses, answered, accepted, visitStatuses, services, starts, perProfileViews, perProfileRequests, reqWk, viewWk] = await Promise.all([
    db.profileViewEvent.count({ where: { profileId: { in: s.ids }, day: viewDay } }),
    db.booking.groupBy({ by: ["status"], where: inPeriod, _count: { _all: true } }),
    db.booking.count({ where: { ...inPeriod, history: { some: { toStatus: { in: ["ACCEPTED", "REJECTED"] }, fromStatus: "PENDING" } } } }),
    db.booking.count({ where: { ...inPeriod, history: { some: { toStatus: "ACCEPTED", fromStatus: "PENDING" } } } }),
    db.booking.groupBy({ by: ["status"], where: visits, _count: { _all: true } }),
    db.booking.groupBy({ by: ["serviceNameSnap"], where: { ...visits, status: { in: ["ACCEPTED", "COMPLETED"] } }, _count: { _all: true }, orderBy: { _count: { serviceNameSnap: "desc" } }, take: 6 }),
    db.booking.findMany({ where: { ...visits, status: { in: ["ACCEPTED", "COMPLETED", "NO_SHOW"] } }, select: { startAt: true }, take: 5000 }),
    db.profileViewEvent.groupBy({ by: ["profileId"], where: { profileId: { in: s.ids }, day: viewDay }, _count: { _all: true } }),
    db.booking.groupBy({ by: ["profileId"], where: inPeriod, _count: { _all: true } }),
    none
      ? Promise.resolve([] as { wk: string; n: bigint }[])
      : db.$queryRaw<{ wk: string; n: bigint }[]>`
          SELECT to_char(date_trunc('week', ("createdAt" AT TIME ZONE 'Africa/Algiers') + interval '2 days') - interval '2 days', 'YYYY-MM-DD') AS wk, count(*) AS n
          FROM "Booking" WHERE "profileId" IN (${idList}) AND "createdAt" >= ${weeks[0].start} GROUP BY 1`,
    none
      ? Promise.resolve([] as { wk: string; n: bigint }[])
      : db.$queryRaw<{ wk: string; n: bigint }[]>`
          SELECT to_char(date_trunc('week', "day" + interval '2 days') - interval '2 days', 'YYYY-MM-DD') AS wk, count(*) AS n
          FROM "ProfileViewEvent" WHERE "profileId" IN (${idList}) AND "day" >= ${new Date(`${weeks[0].date}T00:00:00Z`)} GROUP BY 1`,
  ]);

  const count = (rows: { status: string; _count: { _all: number } }[], ...st: string[]) => rows.filter((r) => st.includes(r.status)).reduce((n, r) => n + r._count._all, 0);
  const requests = requestStatuses.reduce((n, r) => n + r._count._all, 0);
  const completed = count(visitStatuses, "COMPLETED");
  const noShow = count(visitStatuses, "NO_SHOW");
  const cancelledByClient = count(visitStatuses, "CANCELLED_BY_CLIENT");
  const cancelledByYou = count(visitStatuses, "CANCELLED_BY_PROVIDER");
  const expired = count(requestStatuses, "EXPIRED");
  const reqMap = new Map(reqWk.map((r) => [r.wk, Number(r.n)]));
  const viewMap = new Map(viewWk.map((r) => [r.wk, Number(r.n)]));
  const viewsBy = new Map(perProfileViews.map((r) => [r.profileId, r._count._all]));
  const reqBy = new Map(perProfileRequests.map((r) => [r.profileId, r._count._all]));
  const profiles = s.active ? s.all.filter((p) => p.category.slug === s.active) : s.all;

  return {
    categories: s.categories,
    active: s.active,
    funnel: { views, requests, answered, accepted, completed },
    rates: {
      conversion: rate(requests, views),
      acceptance: rate(accepted, answered),
      expiry: rate(expired, requests),
      noShow: rate(noShow, completed + noShow),
      cancellation: rate(cancelledByClient + cancelledByYou, completed + noShow + cancelledByClient + cancelledByYou),
    },
    outcomes: { completed, noShow, cancelledByClient, cancelledByYou, expired },
    services: services.map((r) => ({ name: r.serviceNameSnap, count: r._count._all })),
    weekdays: weekdayHistogram(starts.map((b) => b.startAt)),
    hours: hourHistogram(starts.map((b) => b.startAt)),
    perCategory: profiles.map((p) => ({ category: p.category.slug, views: viewsBy.get(p.id) ?? 0, requests: reqBy.get(p.id) ?? 0, conversion: rate(reqBy.get(p.id) ?? 0, viewsBy.get(p.id) ?? 0) })),
    series: weeks.map((w) => ({ week: w.date, requests: reqMap.get(w.date) ?? 0, views: viewMap.get(w.date) ?? 0 })),
  };
}
