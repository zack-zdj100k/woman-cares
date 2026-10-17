import "server-only";
import { db } from "@/lib/db";
import { lastMonths } from "@/lib/insights";
import { algiersMidnight, lastWeeks, periodRange } from "@/lib/periods";
import { canViewModeration, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { publicProfileWhere } from "./discovery";

/** Weekly counts in SQL, grouped by Algiers weeks starting on Saturday (Monday-based trunc, shifted 2 days). */
async function weekly(table: "Booking" | "User", since: Date, where = "") {
  const rows = await db.$queryRawUnsafe<{ wk: string; n: bigint }[]>(
    `SELECT to_char(date_trunc('week', ("createdAt" AT TIME ZONE 'Africa/Algiers') + interval '2 days') - interval '2 days', 'YYYY-MM-DD') AS wk, count(*) AS n
     FROM "${table}" WHERE "createdAt" >= $1 ${where} GROUP BY 1`,
    since,
  );
  return new Map(rows.map((r) => [r.wk, Number(r.n)]));
}

/** Platform overview for staff. Every number is a count of real rows. */
export async function getAdminOverview(actor: Actor) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  const weeks = lastWeeks(8);
  const month = periodRange("month");
  const [clients, providers, published, bookingsMonth, pendingBookings, openSupport, bookingsWk, clientsWk, prosWk, audit] = await Promise.all([
    db.user.count({ where: { role: "CLIENT" } }),
    db.providerAccount.count(),
    db.providerServiceProfile.count({ where: publicProfileWhere }),
    db.booking.count({ where: { createdAt: { gte: month.from } } }),
    db.booking.count({ where: { status: "PENDING" } }),
    db.supportRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    weekly("Booking", weeks[0].start),
    weekly("User", weeks[0].start, `AND role = 'CLIENT'`),
    weekly("User", weeks[0].start, `AND role = 'PROVIDER'`),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { fullName: true } } } }),
  ]);
  return {
    clients,
    providers,
    published,
    bookingsMonth,
    pendingBookings,
    openSupport,
    series: weeks.map((w) => ({ week: w.date, bookings: bookingsWk.get(w.date) ?? 0, clients: clientsWk.get(w.date) ?? 0, providers: prosWk.get(w.date) ?? 0 })),
    audit: audit.map((a) => ({ id: a.id, action: a.action, actor: a.actor?.fullName ?? null, at: a.createdAt })),
    money: await money(),
  };
}

/**
 * Woman Cares' own revenue: subscription payments verified by staff (status PAID), dated by the
 * day the money was received. "Invoiced" is what was billed (invoices by issue month). No costs are
 * recorded on the platform, so revenue collected is the figure to read as income.
 */
async function money() {
  const months = lastMonths(12);
  const month = periodRange("month");
  const since = algiersMidnight(`${months[0]}-01`);
  const [paidWk, invoicedWk, total, thisMonth, lastMonth, outstanding, pending] = await Promise.all([
    db.$queryRaw<{ m: string; v: string | null }[]>`
      SELECT to_char(COALESCE("verifiedAt", "createdAt") AT TIME ZONE 'Africa/Algiers', 'YYYY-MM') AS m, sum(amount)::text AS v
      FROM "SubscriptionPayment" WHERE status = 'PAID' AND COALESCE("verifiedAt", "createdAt") >= ${since} GROUP BY 1`,
    db.$queryRaw<{ m: string; v: string | null }[]>`
      SELECT to_char("issuedAt" AT TIME ZONE 'Africa/Algiers', 'YYYY-MM') AS m, sum(total)::text AS v
      FROM "Invoice" WHERE status <> 'VOID' AND "issuedAt" >= ${since} GROUP BY 1`,
    db.subscriptionPayment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.subscriptionPayment.aggregate({ where: { status: "PAID", verifiedAt: { gte: month.from, lt: month.to } }, _sum: { amount: true } }),
    db.subscriptionPayment.aggregate({ where: { status: "PAID", verifiedAt: { gte: month.prevFrom, lt: month.from } }, _sum: { amount: true } }),
    db.invoice.aggregate({ where: { status: { in: ["OPEN", "OVERDUE"] } }, _sum: { total: true }, _count: { _all: true } }),
    db.subscriptionPayment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const paid = new Map(paidWk.map((r) => [r.m, Number(r.v ?? 0)]));
  const invoiced = new Map(invoicedWk.map((r) => [r.m, Number(r.v ?? 0)]));
  const n = (v: { toString(): string } | null | undefined) => Number(v?.toString() ?? 0);
  return {
    total: n(total._sum.amount),
    thisMonth: n(thisMonth._sum.amount),
    lastMonth: n(lastMonth._sum.amount),
    outstanding: n(outstanding._sum.total),
    outstandingCount: outstanding._count._all,
    pending: n(pending._sum.amount),
    pendingCount: pending._count._all,
    series: months.map((m) => ({ month: m, collected: paid.get(m) ?? 0, invoiced: invoiced.get(m) ?? 0 })),
  };
}
