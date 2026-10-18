import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, algiersInstant } from "@/lib/availability";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { getAvailability, requestBooking, respondToBooking } from "@/server/services/bookings";
import { answerProposal, cancelByClient, cancelByProvider, closeVisit, expirePendingBookings, freeSlotsForBooking, leaveReview, proposeTime, recordVisitPayment } from "@/server/services/booking-lifecycle";
import { getProviderBooking, listProviderBookingTable } from "@/server/services/booking-views";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
const DAY = () => addDays(today(), 3);
const AT = (minute = 600) => algiersInstant(DAY(), minute);

let n = 0;
let pro: Actor;
let serviceId: string;
let profileId: string;

async function client(): Promise<Actor> {
  n += 1;
  const u = await db.user.create({ data: { email: `lc${n}@test.invalid`, fullName: `Cliente ${n}`, phone: "0550000000", passwordHash: "x", role: "CLIENT", status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { id: u.id, role: "CLIENT", status: "ACTIVE", emailVerified: true };
}
async function booked(c: Actor, minute = 600, accept = true) {
  const { id } = await requestBooking(c, { profileSlug: "lina-hair", serviceId, startAt: AT(minute).toISOString(), note: null, idempotencyKey: randomUUID() });
  if (accept) await respondToBooking(pro, id, true, null);
  return id;
}
const minutes = async () => (await getAvailability("lina-hair", serviceId, DAY(), 1))![0].slots.map((s) => s.minute);
const templates = async () => (await db.outboxEvent.findMany({ orderBy: { createdAt: "asc" } })).map((e) => (e.payload as { template: string }).template);

beforeEach(async () => {
  await resetDatabase();
  const account = await createProvider({ name: "Salon Lina" });
  await db.user.update({ where: { id: account.userId }, data: { emailVerifiedAt: new Date() } });
  pro = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  const profile = await createProfile(account.id, "coiffeuses", { slug: "lina-hair", services: ["Brushing"], weekdays: [0, 1, 2, 3, 4, 5, 6], startingPrice: 2500 });
  profileId = profile.id;
  serviceId = (await db.providerService.findFirstOrThrow({ where: { profileId } })).id;
});

describe("cancellations", () => {
  it("frees the place when the client cancels, tells the professional, and cannot run twice", async () => {
    const c = await client();
    const id = await booked(c);
    expect(await minutes()).not.toContain(600);
    await cancelByClient(c, id, "Empêchement");
    expect(await minutes()).toContain(600);
    const b = await db.booking.findUniqueOrThrow({ where: { id }, include: { history: true } });
    expect(b.status).toBe("CANCELLED_BY_CLIENT");
    expect(b.cancelledAt).not.toBeNull();
    expect(b.history.at(-1)).toMatchObject({ fromStatus: "ACCEPTED", toStatus: "CANCELLED_BY_CLIENT", reason: "Empêchement" });
    expect((await templates()).at(-1)).toBe("booking-cancelled");
    await expect(cancelByClient(c, id, null)).rejects.toMatchObject({ reason: "state" });
  });

  it("refuses another client's booking and requires a reason from the professional", async () => {
    const owner = await client();
    const id = await booked(owner);
    await expect(cancelByClient(await client(), id, null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(cancelByProvider(pro, id, "  ")).rejects.toMatchObject({ reason: "service" });
    await cancelByProvider(pro, id, "Fermeture exceptionnelle");
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED_BY_PROVIDER");
  });
});

describe("reschedule", () => {
  it("holds both slots while the client decides, then moves the appointment", async () => {
    const c = await client();
    const id = await booked(c, 600);
    const free = await freeSlotsForBooking(pro, id, DAY());
    expect(free).toContain(AT(720).toISOString());
    await proposeTime(pro, id, AT(720).toISOString(), "Plutôt midi ?");
    expect(await minutes()).not.toContain(600);
    expect(await minutes()).not.toContain(720);
    // Someone else cannot take the proposed slot meanwhile.
    await expect(requestBooking(await client(), { profileSlug: "lina-hair", serviceId, startAt: AT(720).toISOString(), note: null, idempotencyKey: randomUUID() })).rejects.toMatchObject({ reason: "slot" });

    await answerProposal(c, id, true);
    const b = await db.booking.findUniqueOrThrow({ where: { id } });
    expect(b.status).toBe("ACCEPTED");
    expect(b.startAt.toISOString()).toBe(AT(720).toISOString());
    expect(b.proposedStartAt).toBeNull();
    expect(await minutes()).toContain(600);
    expect(await templates()).toEqual(expect.arrayContaining(["booking-reschedule", "booking-reschedule-reply"]));
  });

  it("returns to the original state when the client declines, and refuses a taken slot", async () => {
    const c = await client();
    const id = await booked(c, 600, false); // still PENDING
    await booked(await client(), 780);
    await expect(proposeTime(pro, id, AT(780).toISOString(), null)).rejects.toMatchObject({ reason: "slot" });
    await proposeTime(pro, id, AT(660).toISOString(), null);
    await answerProposal(c, id, false);
    const b = await db.booking.findUniqueOrThrow({ where: { id } });
    expect(b.status).toBe("PENDING");
    expect(b.startAt.toISOString()).toBe(AT(600).toISOString());
    expect(await minutes()).toContain(660);
  });
});

describe("after the visit", () => {
  async function pastBooking() {
    const c = await client();
    const id = await booked(c);
    // Move it into the past (the request flow refuses past times by design).
    await db.booking.update({ where: { id }, data: { startAt: new Date(Date.now() - 3 * 3_600_000), endAt: new Date(Date.now() - 2 * 3_600_000) } });
    return { c, id };
  }

  it("completes, records payments and refunds, and accepts one review", async () => {
    const { c, id } = await pastBooking();
    await expect(recordVisitPayment(pro, id, { amount: 2500, method: "cash", refund: false, note: null })).rejects.toMatchObject({ reason: "state" });
    await closeVisit(pro, id, "COMPLETED");
    await recordVisitPayment(pro, id, { amount: 2500, method: "cash", refund: false, note: null });
    await expect(recordVisitPayment(pro, id, { amount: 3000, method: "cash", refund: true, note: null })).rejects.toMatchObject({ reason: "service" });
    await expect(recordVisitPayment(pro, id, { amount: 10, method: "bitcoin", refund: false, note: null })).rejects.toMatchObject({ reason: "service" });
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).paymentStatus).toBe("PAID");
    await recordVisitPayment(pro, id, { amount: 2500, method: "cash", refund: true, note: "Geste" });
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).paymentStatus).toBe("REFUNDED");

    await expect(leaveReview(c, id, 6, null)).rejects.toMatchObject({ reason: "state" });
    await leaveReview(c, id, 5, "Parfait");
    await expect(leaveReview(c, id, 4, null)).rejects.toMatchObject({ reason: "state" });
    expect(await db.review.count({ where: { bookingId: id } })).toBe(1);
  });

  it("records a no-show and hides the phone afterwards", async () => {
    const { id } = await pastBooking();
    expect((await getProviderBooking(pro, id))!.client.phone).toBe("0550000000");
    await closeVisit(pro, id, "NO_SHOW");
    expect((await getProviderBooking(pro, id))!.client.phone).toBeNull();
    await expect(closeVisit(pro, id, "COMPLETED")).rejects.toMatchObject({ reason: "state" });
  });

  it("does not let a future appointment be closed", async () => {
    const id = await booked(await client());
    await expect(closeVisit(pro, id, "COMPLETED")).rejects.toMatchObject({ reason: "state" });
  });
});

describe("expiry and tables", () => {
  it("expires unanswered requests once, freeing the place", async () => {
    const id = await booked(await client(), 600, false);
    await db.booking.update({ where: { id }, data: { pendingExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expirePendingBookings()).toEqual({ expired: 1 });
    expect(await expirePendingBookings()).toEqual({ expired: 0 });
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).status).toBe("EXPIRED");
    expect(await minutes()).toContain(600);
  });

  it("filters the professional table and only shows her own bookings", async () => {
    await booked(await client(), 600, false);
    await booked(await client(), 720);
    // "À venir" holds the request to answer and the confirmed appointment.
    const pending = await listProviderBookingTable(pro, { filter: "upcoming", page: 1 });
    expect(pending.rows.map((r) => r.status)).toEqual(["PENDING", "ACCEPTED"]);
    expect(pending.counts).toMatchObject({ upcoming: 2 });
    expect(pending.pending).toBe(1);
    const search = await listProviderBookingTable(pro, { filter: "all", q: "cliente", page: 1 });
    expect(search.total).toBe(2);
    const other = await createProvider({ name: "Autre" });
    const otherActor: Actor = { id: other.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
    expect((await listProviderBookingTable(otherActor, { filter: "all", page: 1 })).total).toBe(0);
    expect(await getProviderBooking(otherActor, pending.rows[0].id)).toBeNull();
  });
});
