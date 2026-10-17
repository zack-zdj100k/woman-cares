import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, algiersInstant } from "@/lib/availability";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { requestBooking, respondToBooking } from "@/server/services/bookings";
import { closeVisit, recordVisitPayment } from "@/server/services/booking-lifecycle";
import { getProviderAnalytics, getProviderEarnings, getProviderWeek } from "@/server/services/provider-insights";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
let pro: Actor;
let serviceId: string;
let n = 0;

async function client(): Promise<Actor> {
  n += 1;
  const u = await db.user.create({ data: { email: `ins${n}@test.invalid`, fullName: `Cliente ${n}`, passwordHash: "x", role: "CLIENT", status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { id: u.id, role: "CLIENT", status: "ACTIVE", emailVerified: true };
}

/** A visit that happened an hour ago, completed, with what the client paid. */
async function paidVisit(amount: number, method = "cash") {
  const { id } = await requestBooking(await client(), { profileSlug: "lina-hair", serviceId, startAt: algiersInstant(addDays(today(), 3), 600).toISOString(), note: null, idempotencyKey: randomUUID() });
  await respondToBooking(pro, id, true, null);
  await db.booking.update({ where: { id }, data: { startAt: new Date(Date.now() - 2 * 3_600_000), endAt: new Date(Date.now() - 3_600_000) } });
  await closeVisit(pro, id, "COMPLETED");
  if (amount) await recordVisitPayment(pro, id, { amount, method, refund: false, note: null });
  return id;
}

beforeEach(async () => {
  await resetDatabase();
  const account = await createProvider({ name: "Salon Lina" });
  pro = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  const profile = await createProfile(account.id, "coiffeuses", { slug: "lina-hair", services: ["Brushing"], weekdays: [0, 1, 2, 3, 4, 5, 6], startingPrice: 2500 });
  serviceId = (await db.providerService.findFirstOrThrow({ where: { profileId: profile.id } })).id;
});

describe("earnings", () => {
  it("sums what was recorded, net of refunds, and lists visits still unpaid", async () => {
    const first = await paidVisit(3000);
    await paidVisit(2000, "ccp");
    await paidVisit(0);
    await recordVisitPayment(pro, first, { amount: 500, method: "cash", refund: true, note: null });
    const e = await getProviderEarnings(pro, { period: "month" });
    expect(e.stats).toMatchObject({ paid: 5000, refunded: 500, net: 4500, paidCount: 2, average: 2500, unpaid: 1 });
    expect(e.byMethod).toEqual([{ method: "cash", amount: 2500 }, { method: "ccp", amount: 2000 }]);
    expect(e.byCategory).toEqual([{ category: "coiffeuses", amount: 4500 }]);
    expect(e.series.at(-1)!.net).toBe(4500);
    expect(e.recent).toHaveLength(3);
  });

  it("shows nothing for a category she does not have, and refuses other roles", async () => {
    await paidVisit(3000);
    const e = await getProviderEarnings(pro, { period: "month", category: "ongles" });
    expect(e.active).toBeNull(); // unknown category falls back to all of hers
    expect(e.stats.net).toBe(3000);
    await expect(getProviderEarnings(await client(), { period: "month" })).rejects.toBeInstanceOf(ForbiddenError);
    const other = await createProvider({ name: "Autre" });
    const e2 = await getProviderEarnings({ id: other.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true }, { period: "month" });
    expect(e2.stats.net).toBe(0);
    expect(e2.recent).toEqual([]);
  });
});

describe("analytics and calendar", () => {
  it("returns null rates without data, then real ones", async () => {
    const empty = await getProviderAnalytics(pro, { period: "month" });
    expect(empty.rates).toEqual({ conversion: null, acceptance: null, expiry: null, noShow: null, cancellation: null });
    await paidVisit(1000);
    const a = await getProviderAnalytics(pro, { period: "month" });
    expect(a.funnel).toMatchObject({ requests: 1, answered: 1, accepted: 1, completed: 1 });
    expect(a.rates.acceptance).toBe(1);
    expect(a.rates.noShow).toBe(0);
    expect(a.services).toEqual([{ name: "Brushing", count: 1 }]);
  });

  it("returns the week's appointments and opening hours", async () => {
    const c = await client();
    const day = addDays(today(), 1);
    await requestBooking(c, { profileSlug: "lina-hair", serviceId, startAt: algiersInstant(day, 600).toISOString(), note: null, idempotencyKey: randomUUID() });
    const w = await getProviderWeek(pro, { week: day });
    expect(w.days).toHaveLength(7);
    expect(w.days).toContain(day);
    expect(new Date(`${w.days[0]}T00:00:00Z`).getUTCDay()).toBe(6); // starts on Saturday
    expect(w.bookings).toHaveLength(1);
    expect(w.windows.length).toBeGreaterThan(0);
  });
});
