import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, algiersInstant } from "@/lib/availability";
import { businessSettingsSchema, profileDetailsSchema } from "@/lib/validation/provider";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError, confirmEmailManually } from "@/server/services/admin-users";
import { getAvailability, requestBooking, respondToBooking } from "@/server/services/bookings";
import { algiersAt, createManualBooking, moveBooking, setAgreedPrice, updateGuest } from "@/server/services/booking-manual";
import { getProviderBooking } from "@/server/services/booking-views";
import { replaceWeeklySchedule, updateBusinessSettings, updateProfileDetails } from "@/server/services/provider-profiles";
import { getProviderWeek } from "@/server/services/provider-insights";
import { setMyAvatar } from "@/server/services/account";
import { attachReceipt, readReceipt } from "@/server/services/receipts";
import { getTargets, meetsTarget, setTargets } from "@/server/services/targets";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
const DAY = () => addDays(today(), 3);
let pro: Actor;
let profileId: string;
let serviceId: string;
let n = 0;

async function user(role: "CLIENT" | "ADMIN" | "SUPER_ADMIN" | "SUPPORT", verified = true): Promise<Actor> {
  n += 1;
  const u = await db.user.create({ data: { email: `ct${n}@test.invalid`, fullName: `${role} ${n}`, passwordHash: "x", role, status: verified ? "ACTIVE" : "PENDING_VERIFICATION", emailVerifiedAt: verified ? new Date() : null } });
  return { id: u.id, role, status: verified ? "ACTIVE" : "PENDING_VERIFICATION", emailVerified: verified };
}

beforeEach(async () => {
  await resetDatabase();
  await db.$executeRawUnsafe(`TRUNCATE "SubscriptionPayment", "InvoiceLine", "Invoice", "SubscriptionItem", "ProviderSubscription", "PlatformSetting" RESTART IDENTITY CASCADE`);
  const account = await createProvider({ name: "Salon Agenda" });
  pro = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  const profile = await createProfile(account.id, "coiffeuses", { slug: "agenda-hair", services: ["Brushing"], weekdays: [0, 1, 2, 3, 4, 5, 6], startingPrice: 2500 });
  profileId = profile.id;
  serviceId = (await db.providerService.findFirstOrThrow({ where: { profileId } })).id;
});

describe("manual appointments", () => {
  it("adds a client by hand at any hour, even overnight, and edits her name and phone", async () => {
    const b = await createManualBooking(pro, { serviceId, day: DAY(), time: "23:00", durationMinutes: 180, guestName: "  Amira   B ", guestPhone: "0550 11 22 33", price: 4000 });
    const row = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row).toMatchObject({ source: "MANUAL", status: "ACCEPTED", clientId: null, guestName: "Amira B", guestPhone: "0550 11 22 33" });
    expect(row.endAt.getTime() - row.startAt.getTime()).toBe(180 * 60_000); // runs past midnight
    expect(Number(row.agreedPrice)).toBe(4000);
    await updateGuest(pro, b.id, { guestName: "Amira Benali", guestPhone: "" });
    expect((await getProviderBooking(pro, b.id))!.client).toEqual({ fullName: "Amira Benali", phone: null });
    await expect(createManualBooking(pro, { serviceId, day: DAY(), time: "10:00", guestName: "A", guestPhone: "" })).rejects.toMatchObject({ reason: "service" });
    const other = await createProvider({ name: "Autre" });
    await expect(createManualBooking({ id: other.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true }, { serviceId, day: DAY(), time: "10:00", guestName: "Nadia", guestPhone: "" })).rejects.toMatchObject({ reason: "service" });
    const week = await getProviderWeek(pro, { week: DAY() });
    expect(week.bookings.map((x) => x.guestName)).toContain("Amira Benali");
  });

  it("moves a confirmed online appointment directly and tells the client, with an agreed price", async () => {
    const client = await user("CLIENT");
    const { id } = await requestBooking(client, { profileSlug: "agenda-hair", serviceId, startAt: algiersInstant(DAY(), 600).toISOString(), note: null, idempotencyKey: randomUUID() });
    await respondToBooking(pro, id, true, null);
    const nextMonth = addDays(today(), 33);
    await moveBooking(pro, id, { day: nextMonth, time: "14:30", note: "Je suis en formation ce jour-là" });
    const moved = await db.booking.findUniqueOrThrow({ where: { id }, include: { history: { orderBy: { createdAt: "asc" } } } });
    expect(moved.startAt.toISOString()).toBe(algiersAt(nextMonth, "14:30").toISOString());
    expect(moved.status).toBe("ACCEPTED");
    expect(moved.history.at(-1)!.reason).toMatch(/^moved /);
    await setAgreedPrice(pro, id, 3200, "Coupe plus longue");
    expect(Number((await db.booking.findUniqueOrThrow({ where: { id } })).agreedPrice)).toBe(3200);
    const templates = (await db.outboxEvent.findMany()).map((e) => (e.payload as { template: string }).template);
    expect(templates.filter((t) => t === "booking-updated")).toHaveLength(2);
    await expect(moveBooking(pro, id, { day: "2020-01-01", time: "10:00" })).rejects.toMatchObject({ reason: "slot" });
  });
});

describe("schedule and profile", () => {
  it("cuts public start times by the session length", async () => {
    await replaceWeeklySchedule(pro, profileId, [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 540, endMinute: 720, capacity: 1 })), false, 45);
    const day = (await getAvailability("agenda-hair", serviceId, DAY(), 1))![0];
    expect(day.slots.map((s) => s.minute).slice(0, 3)).toEqual([540, 585, 630]);
    expect((await getProviderWeek(pro, { week: DAY() })).step).toBe(45);
  });

  it("keeps her own specialties and a starting price she typed", async () => {
    const input = profileDetailsSchema.parse({ headline: "Coiffure de fête à Alger", description: "Brushing, chignons et soins, avec des produits doux pour tous les cheveux.", specialties: ["brushing"], customSpecialties: "Henné, Soins bio , ", startingPrice: "1 800" });
    await updateProfileDetails(pro, profileId, input);
    const p = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: profileId } });
    expect(p.specialties).toEqual(["brushing", "x:Henné", "x:Soins bio"]);
    expect(Number(p.startingPrice)).toBe(1800);
    expect(p.startingPriceManual).toBe(true);
  });

  it("accepts only Google Maps links and Algerian WhatsApp numbers", async () => {
    const base = { businessName: "Salon Agenda", wilaya: "16", workplaceType: "SALON", locationVisibility: "APPROXIMATE" };
    expect(businessSettingsSchema.safeParse({ ...base, mapsUrl: "https://evil.example/maps" }).success).toBe(false);
    const ok = businessSettingsSchema.parse({ ...base, mapsUrl: "https://maps.app.goo.gl/abc123", whatsapp: "0661 23 45 67", publicEmail: "Contact@Salon.dz" });
    expect(ok).toMatchObject({ mapsUrl: "https://maps.app.goo.gl/abc123", whatsapp: "+213661234567", publicEmail: "contact@salon.dz" });
    await updateBusinessSettings(pro, ok);
    expect(await db.providerAccount.findFirstOrThrow({ select: { whatsapp: true, mapsUrl: true } })).toEqual({ whatsapp: "+213661234567", mapsUrl: "https://maps.app.goo.gl/abc123" });
  });
});

describe("admin tools", () => {
  it("attaches a receipt the professional can download, and nobody else", async () => {
    const admin = await user("ADMIN");
    const sub = await db.providerSubscription.create({ data: { providerId: (await db.providerAccount.findFirstOrThrow()).id, status: "ACTIVE" } });
    const invoice = await db.invoice.create({ data: { number: "WC-TEST-1", subscriptionId: sub.id, providerId: sub.providerId, periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 86_400_000), subtotal: 30000, total: 30000, pricingBasisSnapshot: {}, dueAt: new Date(), status: "PAID" } });
    const pay = await db.subscriptionPayment.create({ data: { invoiceId: invoice.id, amount: 30000, status: "PAID", method: "CCP" } });
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
    await expect(attachReceipt(pro, pay.id, { file: pdf, note: null, coveredFrom: null, coveredTo: null })).rejects.toBeInstanceOf(ForbiddenError);
    await attachReceipt(admin, pay.id, { file: pdf, note: "Payé d’octobre à novembre", coveredFrom: new Date("2026-10-01"), coveredTo: new Date("2026-10-31") });
    expect((await readReceipt(pro, pay.id)).pdf).toBe(true);
    await expect(readReceipt(await user("CLIENT"), pay.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.notification.count({ where: { userId: pro.id, type: "billing.receipt" } })).toBe(1);
  });

  it("lets the Super Admin set target rates, compared in the right direction", async () => {
    await expect(setTargets(await user("ADMIN"), { conversion: 0.05, acceptance: null, expiry: null, noShow: 0.1, cancellation: null })).rejects.toBeInstanceOf(ForbiddenError);
    await setTargets(await user("SUPER_ADMIN"), { conversion: 0.05, acceptance: null, expiry: null, noShow: 0.1, cancellation: null });
    expect(await getTargets()).toMatchObject({ conversion: 0.05, noShow: 0.1, acceptance: null });
    expect(meetsTarget("conversion", 0.06, 0.05)).toBe(true);
    expect(meetsTarget("noShow", 0.2, 0.1)).toBe(false);
  });

  it("confirms an email by hand (ADMIN+), activating the account", async () => {
    const waiting = await user("CLIENT", false);
    await expect(confirmEmailManually(await user("SUPPORT"), waiting.id)).rejects.toBeInstanceOf(ForbiddenError);
    await confirmEmailManually(await user("ADMIN"), waiting.id);
    const u = await db.user.findUniqueOrThrow({ where: { id: waiting.id } });
    expect(u.status).toBe("ACTIVE");
    expect(u.emailVerifiedAt).not.toBeNull();
  });

  it("stores a square WebP avatar and replaces it", async () => {
    const png = await sharp({ create: { width: 600, height: 300, channels: 3, background: "#c46" } }).png().toBuffer();
    const key = await setMyAvatar(pro, png);
    expect(key).toMatch(/^avatars\/.+\.webp$/);
    await expect(setMyAvatar(pro, Buffer.from("not an image"))).rejects.toMatchObject({ reason: "type" });
    await setMyAvatar(pro, null);
    expect((await db.user.findUniqueOrThrow({ where: { id: pro.id } })).avatarKey).toBeNull();
  });
});

describe("sessions, places and deletion", () => {
  it("offers sessions from opening time, the last one ending at closing time", async () => {
    await replaceWeeklySchedule(pro, profileId, [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 480, endMinute: 1020, capacity: 1 })), false, 60);
    const day = (await getAvailability("agenda-hair", serviceId, DAY(), 1))![0];
    expect(day.slots[0].minute).toBe(480); // 08:00
    expect(day.slots.at(-1)!.minute).toBe(960); // 16:00-17:00 is the last session
  });

  it("refuses a manual client when every place of the session is taken, but not outside opening hours", async () => {
    await replaceWeeklySchedule(pro, profileId, [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 480, endMinute: 1020, capacity: 2 })), false, 60);
    const at = { day: DAY(), time: "10:00", durationMinutes: 60, guestPhone: "" };
    await createManualBooking(pro, { ...at, serviceId, guestName: "Cliente Un" });
    await createManualBooking(pro, { ...at, serviceId, guestName: "Cliente Deux" });
    await expect(createManualBooking(pro, { ...at, serviceId, guestName: "Cliente Trois" })).rejects.toMatchObject({ reason: "full" });
    // The public site no longer offers 10:00 either.
    expect((await getAvailability("agenda-hair", serviceId, DAY(), 1))![0].slots.map((s) => s.minute)).not.toContain(600);
    // After closing time it is her own time.
    await createManualBooking(pro, { ...at, time: "21:00", serviceId, guestName: "Amie" });
  });

  it("accepts a service she types herself, and deletes a booking she added", async () => {
    const b = await createManualBooking(pro, { profileId, serviceName: "Henné mariée", day: DAY(), time: "12:00", durationMinutes: 90, guestName: "Nour", guestPhone: "" });
    const row = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row).toMatchObject({ serviceId: null, serviceNameSnap: "Henné mariée", durationMinSnap: 90 });
    const { deleteBooking } = await import("@/server/services/booking-manual");
    await deleteBooking(pro, b.id);
    expect(await db.booking.count({ where: { id: b.id } })).toBe(0);
    // A live online request cannot be deleted: it must be refused first.
    const client = await user("CLIENT");
    const { id } = await requestBooking(client, { profileSlug: "agenda-hair", serviceId, startAt: algiersInstant(DAY(), 600).toISOString(), note: null, idempotencyKey: randomUUID() });
    await expect(deleteBooking(pro, id)).rejects.toMatchObject({ reason: "state" });
    await respondToBooking(pro, id, false, null);
    await deleteBooking(pro, id);
  });
});

describe("time zone", () => {
  it("stores the real instant whatever the database time zone (10:00 Algiers is 10:00 in SQL too)", async () => {
    await db.$executeRawUnsafe(`ALTER DATABASE "${new URL(process.env.DATABASE_URL!).pathname.slice(1)}" SET timezone TO 'Africa/Algiers'`);
    const b = await createManualBooking(pro, { serviceId, day: DAY(), time: "10:00", guestName: "Heure Test", guestPhone: "" });
    const [row] = await db.$queryRaw<{ local: string; created: boolean }[]>`
      SELECT to_char("startAt" AT TIME ZONE 'Africa/Algiers', 'HH24:MI') AS local, abs(extract(epoch FROM ("createdAt" - now()))) < 60 AS created FROM "Booking" WHERE id = ${b.id}::uuid`;
    expect(row).toEqual({ local: "10:00", created: true });
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).startAt.toISOString()).toBe(algiersAt(DAY(), "10:00").toISOString());
  });
});
