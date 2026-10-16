import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { db } from "@/lib/db";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import {
  LockedError,
  addCategory,
  addClosure,
  archiveProfile,
  createService,
  deleteService,
  getEditorData,
  removeClosure,
  replaceWeeklySchedule,
  submitForReview,
  updateProfileDetails,
  updateService,
} from "@/server/services/provider-profiles";
import { UploadRejected, addPortfolioMedia, deletePortfolioMedia, moveMedia, setCardImage } from "@/server/services/media";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const details = { headline: "Semi-permanent soigné", description: "Description suffisamment longue pour être acceptée par la validation.", specialties: [] as string[] };
const service = { name: "Pose gel", description: null, durationMinutes: 90, bufferMinutes: 0, priceMin: 3500, priceMax: 5000, active: true };

let storageDir: string;
let alice: Actor;
let bob: Actor;
let aliceProfile: string;
let bobProfile: string;

async function actorFor(providerId: string): Promise<Actor> {
  const p = await db.providerAccount.findUniqueOrThrow({ where: { id: providerId } });
  await db.user.update({ where: { id: p.userId }, data: { emailVerifiedAt: new Date() } });
  return { id: p.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
}

async function jpeg() {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: "#d99" } }).jpeg().toBuffer();
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "wc-storage-"));
  process.env.STORAGE_LOCAL_DIR = storageDir;
});

beforeEach(async () => {
  await resetDatabase();
  const a = await createProvider({ name: "Atelier Alice", status: "PENDING_REVIEW" });
  const b = await createProvider({ name: "Studio Bob", status: "PENDING_REVIEW" });
  await db.providerAccount.updateMany({ data: { status: "ONBOARDING" } });
  alice = await actorFor(a.id);
  bob = await actorFor(b.id);
  aliceProfile = (await createProfile(a.id, "nails", { slug: "alice-nails", status: "DRAFT", services: [] })).id;
  bobProfile = (await createProfile(b.id, "nails", { slug: "bob-nails", status: "DRAFT", services: [] })).id;
});

describe("ownership: a provider can never touch another provider's data", () => {
  it("refuses every profile operation on someone else's profile", async () => {
    await expect(getEditorData(alice, bobProfile)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getEditorData(bob, aliceProfile)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateProfileDetails(bob, aliceProfile, details)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createService(bob, aliceProfile, service)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(replaceWeeklySchedule(bob, aliceProfile, [])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addClosure(bob, aliceProfile, "2030-01-01", "2030-01-02", null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(submitForReview(bob, aliceProfile)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(archiveProfile(bob, aliceProfile)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addPortfolioMedia(bob, aliceProfile, await jpeg(), null)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses operations on someone else's services, media and closures by id", async () => {
    await createService(alice, aliceProfile, service);
    const s = await db.providerService.findFirstOrThrow({ where: { profileId: aliceProfile } });
    await expect(updateService(bob, s.id, { ...service, priceMin: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteService(bob, s.id)).rejects.toBeInstanceOf(ForbiddenError);

    const { id: mediaId } = await addPortfolioMedia(alice, aliceProfile, await jpeg(), null);
    await expect(deletePortfolioMedia(bob, mediaId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setCardImage(bob, mediaId)).rejects.toBeInstanceOf(ForbiddenError);

    await addClosure(alice, aliceProfile, "2030-01-01", "2030-01-01", null);
    const ex = await db.scheduleException.findFirstOrThrow({ where: { profileId: aliceProfile } });
    await expect(removeClosure(bob, ex.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.providerService.findUnique({ where: { id: s.id } })).not.toBeNull();
  });

  it("refuses clients, unknown ids and malformed ids alike", async () => {
    const client: Actor = { id: alice.id, role: "CLIENT", status: "ACTIVE", emailVerified: true };
    await expect(getEditorData(client, aliceProfile)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getEditorData(alice, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getEditorData(alice, "../../etc")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("details and services", () => {
  it("keeps only specialties from the category vocabulary", async () => {
    await updateProfileDetails(alice, aliceProfile, { ...details, specialties: ["gel", "gel", "balayage", "nail-art"] });
    const p = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile } });
    expect(p.specialties.sort()).toEqual(["gel", "nail-art"]);
  });

  it("keeps the starting price equal to the cheapest active service", async () => {
    await createService(alice, aliceProfile, service);
    await createService(alice, aliceProfile, { ...service, name: "Manucure", priceMin: 2000, priceMax: null });
    const price = async () => (await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile } })).startingPrice?.toString();
    expect(await price()).toBe("2000");
    const cheap = await db.providerService.findFirstOrThrow({ where: { name: "Manucure" } });
    await updateService(alice, cheap.id, { ...service, name: "Manucure", priceMin: 2000, priceMax: null, active: false });
    expect(await price()).toBe("3500");
  });

  it("deactivates (never deletes) a service that has bookings, leaving the booking snapshot intact", async () => {
    await createService(alice, aliceProfile, service);
    const s = await db.providerService.findFirstOrThrow({ where: { profileId: aliceProfile } });
    const client = await db.user.create({ data: { email: "c@test.invalid", fullName: "Client", passwordHash: "x" } });
    const owner = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile } });
    const start = new Date("2030-03-02T09:00:00Z");
    await db.booking.create({
      data: {
        reference: "WC-T1", clientId: client.id, providerId: owner.providerId, profileId: aliceProfile, serviceId: s.id,
        startAt: start, endAt: new Date(start.getTime() + 5_400_000), requestedStartAt: start, status: "ACCEPTED",
        serviceNameSnap: "Pose gel", durationMinSnap: 90, priceMinSnap: 3500,
      },
    });
    await updateService(alice, s.id, { ...service, name: "Pose gel premium", priceMin: 6000, priceMax: null });
    expect(await deleteService(alice, s.id)).toMatchObject({ deactivated: true });
    expect((await db.providerService.findUniqueOrThrow({ where: { id: s.id } })).active).toBe(false);
    const booking = await db.booking.findUniqueOrThrow({ where: { reference: "WC-T1" } });
    expect(booking.serviceNameSnap).toBe("Pose gel");
    expect(booking.priceMinSnap.toString()).toBe("3500");
  });
});

describe("weekly schedule", () => {
  const saturday = (start: number, end: number, capacity = 2) => ({ weekday: 6, startMinute: start, endMinute: end, capacity });

  it("replaces the weekly hours atomically", async () => {
    await replaceWeeklySchedule(alice, aliceProfile, [saturday(540, 780), saturday(840, 1140)]);
    await replaceWeeklySchedule(alice, aliceProfile, [saturday(600, 1080, 3)]);
    const rows = await db.workingSchedule.findMany({ where: { profileId: aliceProfile } });
    expect(rows.map((r) => [r.startMinute, r.endMinute, r.capacity])).toEqual([[600, 1080, 3]]);
  });

  it("refuses to drop hours that hold future bookings unless the provider confirms; bookings are never moved", async () => {
    await createService(alice, aliceProfile, service);
    const s = await db.providerService.findFirstOrThrow({ where: { profileId: aliceProfile } });
    const client = await db.user.create({ data: { email: "c2@test.invalid", fullName: "Client", passwordHash: "x" } });
    const owner = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile } });
    // Saturday 2030-03-02, 10:00-11:30 in Algiers (09:00Z).
    const start = new Date("2030-03-02T09:00:00Z");
    await db.booking.create({
      data: {
        reference: "WC-SAT", clientId: client.id, providerId: owner.providerId, profileId: aliceProfile, serviceId: s.id,
        startAt: start, endAt: new Date(start.getTime() + 5_400_000), requestedStartAt: start, status: "ACCEPTED",
        serviceNameSnap: "Pose gel", durationMinSnap: 90, priceMinSnap: 3500,
      },
    });
    expect(await replaceWeeklySchedule(alice, aliceProfile, [saturday(540, 1080)])).toMatchObject({ status: "saved" });
    const r = await replaceWeeklySchedule(alice, aliceProfile, [saturday(720, 1080)]);
    expect(r).toEqual({ status: "conflicts", references: ["WC-SAT"] });
    expect((await db.workingSchedule.findFirstOrThrow({ where: { profileId: aliceProfile } })).startMinute).toBe(540);
    expect(await replaceWeeklySchedule(alice, aliceProfile, [saturday(720, 1080)], true)).toMatchObject({ status: "saved" });
    const b = await db.booking.findUniqueOrThrow({ where: { reference: "WC-SAT" } });
    expect(b.status).toBe("ACCEPTED");
    expect(b.startAt.toISOString()).toBe(start.toISOString());
  });

  it("adds closures day by day without duplicates and removes them", async () => {
    await addClosure(alice, aliceProfile, "2030-01-01", "2030-01-03", "Formation");
    await addClosure(alice, aliceProfile, "2030-01-02", "2030-01-04", null);
    const days = await db.scheduleException.findMany({ where: { profileId: aliceProfile }, orderBy: { date: "asc" } });
    expect(days.map((d) => d.date.toISOString().slice(0, 10))).toEqual(["2030-01-01", "2030-01-02", "2030-01-03", "2030-01-04"]);
    await removeClosure(alice, days[0].id);
    expect(await db.scheduleException.count({ where: { profileId: aliceProfile } })).toBe(3);
  });
});

describe("portfolio media", () => {
  it("stores re-encoded WebP files, makes the first image the card image and rejects fakes", async () => {
    const first = await addPortfolioMedia(alice, aliceProfile, await jpeg(), "Pose gel nude");
    const second = await addPortfolioMedia(alice, aliceProfile, await jpeg(), null);
    const rows = await db.portfolioMedia.findMany({ where: { profileId: aliceProfile }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => [r.id, r.mimeType, r.isCardImage])).toEqual([
      [first.id, "image/webp", true],
      [second.id, "image/webp", false],
    ]);
    const files = await readdir(path.join(storageDir, "public", "profiles", aliceProfile));
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith(".webp"))).toBe(true);

    await expect(addPortfolioMedia(alice, aliceProfile, Buffer.from("<svg onload=alert(1)>"), null)).rejects.toMatchObject({ reason: "type" });
    await expect(addPortfolioMedia(alice, aliceProfile, Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]), null)).rejects.toBeInstanceOf(UploadRejected);
    expect(await db.portfolioMedia.count({ where: { profileId: aliceProfile } })).toBe(2);
  });

  it("reorders, switches the card image and hands it on when the card image is deleted", async () => {
    const a = await addPortfolioMedia(alice, aliceProfile, await jpeg(), null);
    const b = await addPortfolioMedia(alice, aliceProfile, await jpeg(), null);
    await moveMedia(alice, b.id, -1);
    const order = await db.portfolioMedia.findMany({ where: { profileId: aliceProfile }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    expect(order.map((o) => o.id)).toEqual([b.id, a.id]);
    await setCardImage(alice, b.id);
    expect((await db.portfolioMedia.findUniqueOrThrow({ where: { id: b.id } })).isCardImage).toBe(true);
    expect((await db.portfolioMedia.findUniqueOrThrow({ where: { id: a.id } })).isCardImage).toBe(false);
    await deletePortfolioMedia(alice, b.id);
    expect((await db.portfolioMedia.findUniqueOrThrow({ where: { id: a.id } })).isCardImage).toBe(true);
    expect(await readdir(path.join(storageDir, "public", "profiles", aliceProfile))).toHaveLength(1);
  });
});

describe("submission for review", () => {
  it("lists what is missing, then moves the profile and the account into review (audited)", async () => {
    expect(await submitForReview(alice, aliceProfile)).toEqual({ status: "incomplete", missing: ["details", "services", "photos", "hours"] });
    await updateProfileDetails(alice, aliceProfile, details);
    await createService(alice, aliceProfile, service);
    await addPortfolioMedia(alice, aliceProfile, await jpeg(), null);
    await replaceWeeklySchedule(alice, aliceProfile, [{ weekday: 6, startMinute: 540, endMinute: 1080, capacity: 1 }]);
    expect(await submitForReview({ ...alice, emailVerified: false }, aliceProfile)).toEqual({ status: "incomplete", missing: ["emailVerified"] });
    expect(await submitForReview(alice, aliceProfile)).toEqual({ status: "submitted" });
    const p = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile }, include: { provider: true } });
    expect(p.status).toBe("PENDING_REVIEW");
    expect(p.provider.status).toBe("PENDING_REVIEW");
    expect(await db.auditLog.count({ where: { action: "profile.submit", entityId: aliceProfile } })).toBe(1);
    expect(await submitForReview(alice, aliceProfile)).toEqual({ status: "not-draft" });
  });

  it("locks restricted profiles against every edit", async () => {
    await db.providerServiceProfile.update({ where: { id: aliceProfile }, data: { status: "RESTRICTED" } });
    await expect(updateProfileDetails(alice, aliceProfile, details)).rejects.toBeInstanceOf(LockedError);
    await expect(createService(alice, aliceProfile, service)).rejects.toBeInstanceOf(LockedError);
    await expect(addPortfolioMedia(alice, aliceProfile, await jpeg(), null)).rejects.toBeInstanceOf(LockedError);
    await expect(archiveProfile(alice, aliceProfile)).rejects.toBeInstanceOf(LockedError);
  });
});

describe("categories on one account", () => {
  it("adds a draft profile for regular categories, a request for Botox, and archives without deleting", async () => {
    expect(await addCategory(alice, "coiffeuses")).toBe("created-profile");
    expect(await addCategory(alice, "coiffeuses")).toBe("exists");
    expect(await addCategory(alice, "botox")).toBe("requested");
    expect(await addCategory(alice, "botox")).toBe("exists");
    const account = await db.providerAccount.findFirstOrThrow({ where: { userId: alice.id }, include: { profiles: { include: { category: true } } } });
    expect(account.profiles.map((p) => p.category.slug).sort()).toEqual(["coiffeuses", "nails"]);
    expect(await db.providerAccount.count({ where: { userId: alice.id } })).toBe(1);

    await archiveProfile(alice, aliceProfile);
    expect((await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile } })).status).toBe("ARCHIVED");
    await expect(updateProfileDetails(alice, aliceProfile, details)).rejects.toBeInstanceOf(LockedError);
    expect(await addCategory(alice, "nails")).toBe("created-profile");
    expect((await db.providerServiceProfile.findUniqueOrThrow({ where: { id: aliceProfile } })).status).toBe("DRAFT");
  });
});
