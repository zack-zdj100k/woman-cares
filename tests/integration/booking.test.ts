import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, algiersInstant } from "@/lib/availability";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { BookingBlocked, getAvailability, listClientBookings, listProviderBookings, requestBooking, respondToBooking } from "@/server/services/bookings";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
const DAY = () => addDays(today(), 3);
const AT = (minute = 600) => algiersInstant(DAY(), minute).toISOString();

let n = 0;
let providerActor: Actor;
let serviceId: string;
let profileId: string;

async function client(verified = true): Promise<Actor> {
  n += 1;
  const u = await db.user.create({ data: { email: `client${n}@test.invalid`, fullName: `Cliente ${n}`, passwordHash: "x", role: "CLIENT", status: "ACTIVE", emailVerifiedAt: verified ? new Date() : null } });
  return { id: u.id, role: "CLIENT", status: "ACTIVE", emailVerified: verified };
}
const ask = (actor: Actor, minute = 600, key = randomUUID()) => requestBooking(actor, { profileSlug: "lina-hair", serviceId, startAt: AT(minute), note: "Cheveux longs", idempotencyKey: key });

beforeEach(async () => {
  await resetDatabase();
  const account = await createProvider({ name: "Salon Lina" });
  await db.user.update({ where: { id: account.userId }, data: { emailVerifiedAt: new Date() } });
  providerActor = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  const profile = await createProfile(account.id, "coiffeuses", { slug: "lina-hair", services: ["Brushing"], weekdays: [0, 1, 2, 3, 4, 5, 6], startingPrice: 2500 });
  profileId = profile.id;
  serviceId = (await db.providerService.findFirstOrThrow({ where: { profileId } })).id;
});

describe("availability", () => {
  it("lists two weeks of free starts from the weekly hours", async () => {
    const days = (await getAvailability("lina-hair", serviceId, undefined))!;
    expect(days).toHaveLength(14);
    const target = days.find((d) => d.date === DAY())!;
    expect(target.slots.map((s) => s.minute)).toContain(600);
    expect(target.slots[0].minute).toBe(540);
  });

  it("hides closed days and unknown or private profiles", async () => {
    await db.scheduleException.create({ data: { profileId, date: new Date(`${DAY()}T00:00:00Z`), isClosed: true } });
    const days = (await getAvailability("lina-hair", serviceId, DAY(), 1))!;
    expect(days[0].slots).toEqual([]);
    expect(await getAvailability("nobody", serviceId, undefined)).toBeNull();
    await db.providerServiceProfile.update({ where: { id: profileId }, data: { status: "DRAFT" } });
    expect(await getAvailability("lina-hair", serviceId, undefined)).toBeNull();
  });
});

describe("requesting a time", () => {
  it("creates a pending request that takes the place, with history, notifications and emails", async () => {
    const c = await client();
    const { reference } = await ask(c);
    expect(reference).toMatch(/^WC-[A-Z2-9]{6}$/);
    const booking = await db.booking.findFirstOrThrow({ include: { history: true } });
    expect(booking.status).toBe("PENDING");
    expect(booking.serviceNameSnap).toBe("Brushing");
    expect(booking.clientNote).toBe("Cheveux longs");
    expect(booking.history.map((h) => h.toStatus)).toEqual(["PENDING"]);
    const templates = (await db.outboxEvent.findMany()).map((e) => (e.payload as { template: string }).template).sort();
    expect(templates).toEqual(["booking-received", "booking-request"]);
    expect(await db.notification.count()).toBe(2);

    const day = (await getAvailability("lina-hair", serviceId, DAY(), 1))![0];
    expect(day.slots.map((s) => s.minute)).not.toContain(600);
    expect(day.slots.map((s) => s.minute)).not.toContain(555); // would overlap
    await expect(ask(await client())).rejects.toMatchObject({ reason: "slot" });
  });

  it("returns the first request when the same submission arrives twice", async () => {
    const c = await client();
    const key = randomUUID();
    const a = await ask(c, 600, key);
    const b = await ask(c, 600, key);
    expect(b.reference).toBe(a.reference);
    expect(await db.booking.count()).toBe(1);
  });

  it("gives the last places to exactly as many clients as the capacity allows", async () => {
    await db.workingSchedule.updateMany({ where: { profileId }, data: { capacity: 2 } });
    const clients = await Promise.all(Array.from({ length: 5 }, () => client()));
    const results = await Promise.allSettled(clients.map((c) => ask(c)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(BookingBlocked);
      expect((r as PromiseRejectedResult).reason.reason).toBe("slot");
    }
    expect(await db.booking.count({ where: { status: "PENDING" } })).toBe(2);
  });

  it("accepts clients (confirmed e-mail not required for now), never the professional herself, and refuses unknown times", async () => {
    await expect(ask(providerActor)).rejects.toMatchObject({ reason: "role" });
    await expect(ask(await client(false))).resolves.toMatchObject({ reference: expect.stringMatching(/^WC-/) });
    await expect(ask(await client(), 607)).rejects.toMatchObject({ reason: "slot" }); // off the grid
    await expect(ask(await client(), 20 * 60)).rejects.toMatchObject({ reason: "slot" }); // after closing
    await expect(requestBooking(await client(), { profileSlug: "lina-hair", serviceId: randomUUID(), startAt: AT(), note: null, idempotencyKey: randomUUID() })).rejects.toMatchObject({ reason: "service" });
  });

  it("caps open requests per client", async () => {
    const c = await client();
    for (const minute of [540, 600, 660, 720, 780]) await ask(c, minute);
    await expect(ask(c, 840)).rejects.toMatchObject({ reason: "limit" });
  });
});

describe("answering a request", () => {
  it("lets only the owning professional accept, once, and tells the client", async () => {
    const c = await client();
    await ask(c);
    const booking = await db.booking.findFirstOrThrow();
    const other = await createProvider({ name: "Autre salon" });
    const otherActor: Actor = { id: other.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
    await expect(respondToBooking(otherActor, booking.id, true, null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(respondToBooking(c, booking.id, true, null)).rejects.toBeInstanceOf(ForbiddenError);

    await respondToBooking(providerActor, booking.id, true, "À samedi !");
    const updated = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { history: { orderBy: { createdAt: "asc" } } } });
    expect(updated.status).toBe("ACCEPTED");
    expect(updated.providerNote).toBe("À samedi !");
    expect(updated.history.map((h) => h.toStatus)).toEqual(["PENDING", "ACCEPTED"]);
    const decision = (await db.outboxEvent.findMany()).find((e) => (e.payload as { template: string }).template === "booking-decision");
    expect((decision!.payload as { to: string; data: { outcome: string } }).data.outcome).toBe("approved");
    await expect(respondToBooking(providerActor, booking.id, false, null)).rejects.toMatchObject({ reason: "state" });

    expect((await listProviderBookings(providerActor)).map((b) => b.status)).toEqual(["ACCEPTED"]);
    expect((await listClientBookings(c)).rows.map((b) => b.reference)).toEqual([booking.reference]);
  });

  it("frees the place when a request is declined", async () => {
    await ask(await client());
    const booking = await db.booking.findFirstOrThrow();
    await respondToBooking(providerActor, booking.id, false, null);
    const day = (await getAvailability("lina-hair", serviceId, DAY(), 1))![0];
    expect(day.slots.map((s) => s.minute)).toContain(600);
  });
});
