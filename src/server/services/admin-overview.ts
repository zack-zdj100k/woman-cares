import "server-only";
import { db } from "@/lib/db";
import { lastWeeks, periodRange } from "@/lib/periods";
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
  };
}
