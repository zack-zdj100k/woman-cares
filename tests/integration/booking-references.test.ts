import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, algiersInstant } from "@/lib/availability";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { addBookingReference, listBookingReferenceIds, readBookingReference, MAX_REFERENCES_PER_BOOKING } from "@/server/services/booking-references";
import { requestBooking } from "@/server/services/bookings";
import { UploadRejected } from "@/server/services/media";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

let storageDir: string;
let n = 0;
let provider: Actor;
let other: Actor;
let owner: Actor;
let bookingId: string;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
const photo = () => sharp({ create: { width: 640, height: 480, channels: 3, background: "#c98" } }).jpeg().toBuffer();
const clientActor = async (): Promise<Actor> => {
  n += 1;
  const u = await db.user.create({ data: { email: `ref${n}@test.invalid`, fullName: `Cliente ${n}`, passwordHash: "x", role: "CLIENT", status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { id: u.id, role: "CLIENT", status: "ACTIVE", emailVerified: true };
};

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "wc-refs-"));
  process.env.STORAGE_LOCAL_DIR = storageDir;
});
afterAll(() => rm(storageDir, { recursive: true, force: true }));

beforeEach(async () => {
  await resetDatabase();
  const account = await createProvider({ name: "Salon Lina" });
  await db.user.update({ where: { id: account.userId }, data: { emailVerifiedAt: new Date() } });
  provider = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  const profile = await createProfile(account.id, "coiffeuses", { slug: "lina-hair", services: ["Brushing"], weekdays: [0, 1, 2, 3, 4, 5, 6], startingPrice: 2500 });
  const serviceId = (await db.providerService.findFirstOrThrow({ where: { profileId: profile.id } })).id;
  owner = await clientActor();
  other = await clientActor();
  const { id } = await requestBooking(owner, { profileSlug: "lina-hair", serviceId, startAt: algiersInstant(addDays(today(), 3), 600).toISOString(), note: "Je veux ce modèle", idempotencyKey: randomUUID() });
  bookingId = id;
});

describe("example photos on a booking", () => {
  it("stores a re-encoded private image the client, her professional and staff can read", async () => {
    const { id } = await addBookingReference(owner, bookingId, await photo());
    expect(await listBookingReferenceIds(owner, bookingId)).toEqual([id]);
    const row = await db.bookingReferenceMedia.findFirstOrThrow();
    expect(row.mimeType).toBe("image/webp");
    expect(row.storageKey).toMatch(new RegExp(`^bookings/${bookingId}/`));
    const mine = await readBookingReference(owner, bookingId, id);
    expect((await sharp(mine).metadata()).format).toBe("webp");
    await expect(readBookingReference(provider, bookingId, id)).resolves.toBeTruthy();
    const admin: Actor = { id: randomUUID(), role: "ADMIN", status: "ACTIVE", emailVerified: true };
    await expect(readBookingReference(admin, bookingId, id)).resolves.toBeTruthy();
  });

  it("hides the photos from other clients and unverified staff", async () => {
    const { id } = await addBookingReference(owner, bookingId, await photo());
    await expect(readBookingReference(other, bookingId, id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listBookingReferenceIds(other, bookingId)).rejects.toBeInstanceOf(ForbiddenError);
    const staff: Actor = { id: randomUUID(), role: "ADMIN", status: "ACTIVE", emailVerified: false };
    await expect(readBookingReference(staff, bookingId, id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("only lets the booking's own client add photos", async () => {
    await expect(addBookingReference(other, bookingId, await photo())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addBookingReference(provider, bookingId, await photo())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses non-images, corrupt files, too many photos and closed bookings", async () => {
    await expect(addBookingReference(owner, bookingId, Buffer.from("<html>not an image</html>"))).rejects.toMatchObject({ reason: "type" });
    await expect(addBookingReference(owner, bookingId, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(50)]))).rejects.toBeInstanceOf(UploadRejected);
    for (let i = 0; i < MAX_REFERENCES_PER_BOOKING; i++) await addBookingReference(owner, bookingId, await photo());
    await expect(addBookingReference(owner, bookingId, await photo())).rejects.toMatchObject({ reason: "limit" });
    await db.booking.update({ where: { id: bookingId }, data: { status: "REJECTED" } });
    await expect(addBookingReference(owner, bookingId, await photo())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps a long description of up to 1000 characters", async () => {
    const note = "Je souhaite un balayage miel. ".repeat(33).trim();
    expect(note.length).toBeGreaterThan(500);
    const profile = await db.providerServiceProfile.findFirstOrThrow();
    const serviceId = (await db.providerService.findFirstOrThrow({ where: { profileId: profile.id } })).id;
    const c = await clientActor();
    const { id } = await requestBooking(c, { profileSlug: "lina-hair", serviceId, startAt: algiersInstant(addDays(today(), 4), 600).toISOString(), note, idempotencyKey: randomUUID() });
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).clientNote).toBe(note);
  });
});
