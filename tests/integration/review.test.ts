import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import type { Actor, Role } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { searchDirectory } from "@/server/services/directory";
import { parseDirectoryQuery } from "@/lib/validation/directory";
import { addCredential, hasValidCredential, isPdf, readCredentialFile, reviewCredential } from "@/server/services/credentials";
import {
  ReviewBlocked,
  approveProfile,
  decideCategoryRequest,
  getProviderReview,
  listProviderQueue,
  queueCounts,
  reinstateProfile,
  requestProfileChanges,
  setProviderStatus,
  setProviderVerified,
  suspendProfile,
} from "@/server/services/review";
import { createProfile, createProvider, resetDatabase } from "./fixtures";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const NOTE = "Merci d’ajouter des photos de vos réalisations.";
const slugs = (r: { cards: { slug: string }[] }) => r.cards.map((c) => c.slug).sort();

let admin: Actor;
let support: Actor;
let provider: Actor;
let providerId: string;
let profileId: string;

async function staff(role: Role, email: string): Promise<Actor> {
  const u = await db.user.create({ data: { email, fullName: `${role} Test`, passwordHash: "x", role, status: "ACTIVE", emailVerifiedAt: new Date() } });
  return { id: u.id, role, status: "ACTIVE", emailVerified: true };
}

/** A profile that satisfies the publication checklist, sitting in the review queue. */
async function readyProfile(provId: string, category: string, slug: string) {
  const p = await createProfile(provId, category, { slug, status: "DRAFT", services: ["Pose gel"], weekdays: [6], startingPrice: 3000 });
  await db.portfolioMedia.create({ data: { profileId: p.id, type: "IMAGE", storageKey: `profiles/${p.id}/a.webp`, mimeType: "image/webp", isCardImage: true } });
  return db.providerServiceProfile.update({
    where: { id: p.id },
    data: { status: "PENDING_REVIEW", publishedAt: null, description: "Une description assez longue pour passer la vérification de complétude." },
  });
}

beforeAll(async () => {
  process.env.STORAGE_LOCAL_DIR = await mkdtemp(path.join(tmpdir(), "wc-review-"));
});

beforeEach(async () => {
  await resetDatabase();
  admin = await staff("ADMIN", "admin@test.invalid");
  support = await staff("SUPPORT", "support@test.invalid");
  const account = await createProvider({ name: "Atelier Nour", status: "PENDING_REVIEW" });
  await db.providerAccount.update({ where: { id: account.id }, data: { status: "ONBOARDING" } });
  await db.user.update({ where: { id: account.userId }, data: { emailVerifiedAt: new Date() } });
  providerId = account.id;
  provider = { id: account.userId, role: "PROVIDER", status: "ACTIVE", emailVerified: true };
  profileId = (await readyProfile(providerId, "nails", "nour-nails")).id;
});

describe("who can review", () => {
  it("lets SUPPORT read the queue but never decide", async () => {
    expect((await listProviderQueue(support, "pending", undefined, 1)).total).toBe(1);
    expect((await getProviderReview(support, providerId)).profiles).toHaveLength(1);
    await expect(approveProfile(support, profileId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setProviderStatus(support, providerId, "approve", "")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setProviderVerified(support, providerId, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses providers everywhere, including on their own profile", async () => {
    await expect(listProviderQueue(provider, "pending", undefined, 1)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(queueCounts(provider)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getProviderReview(provider, providerId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(approveProfile(provider, profileId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setProviderVerified(provider, providerId, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("filters and searches the queue", async () => {
    expect((await listProviderQueue(admin, "pending", "nour", 1)).total).toBe(1);
    expect((await listProviderQueue(admin, "pending", "inconnu", 1)).total).toBe(0);
    expect((await listProviderQueue(admin, "approved", undefined, 1)).total).toBe(0);
    expect(await queueCounts(admin)).toEqual({ providers: 1, profiles: 1, requests: 0, credentials: 0 });
  });
});

describe("profile decisions", () => {
  it("approval publishes the profile, approves the account, audits and notifies", async () => {
    expect(slugs(await searchDirectory("nails", parseDirectoryQuery({})))).toEqual([]);
    await approveProfile(admin, profileId);

    const p = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: profileId }, include: { provider: true } });
    expect(p.status).toBe("PUBLISHED");
    expect(p.publishedAt).not.toBeNull();
    expect(p.provider.status).toBe("APPROVED");
    expect(slugs(await searchDirectory("nails", parseDirectoryQuery({})))).toEqual(["nour-nails"]);

    const actions = (await db.auditLog.findMany({ where: { actorId: admin.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(["profile.approve", "provider.approve"]);
    expect(await db.notification.count({ where: { userId: provider.id, type: "review.profile-published" } })).toBe(1);
    const outbox = await db.outboxEvent.findMany();
    expect(outbox.map((e) => (e.payload as { template: string }).template)).toEqual(["profile-published"]);

    await expect(approveProfile(admin, profileId)).rejects.toMatchObject({ reason: "state" });
  });

  it("refuses incomplete profiles and owners with unverified email", async () => {
    await db.portfolioMedia.deleteMany({ where: { profileId } });
    await expect(approveProfile(admin, profileId)).rejects.toMatchObject({ reason: "incomplete" });
    await db.portfolioMedia.create({ data: { profileId, type: "IMAGE", storageKey: "profiles/x/b.webp", mimeType: "image/webp" } });
    await db.user.update({ where: { id: provider.id }, data: { emailVerifiedAt: null } });
    await expect(approveProfile(admin, profileId)).rejects.toMatchObject({ reason: "account" });
  });

  it("a change request sends the profile back to DRAFT with the note", async () => {
    await expect(requestProfileChanges(admin, profileId, "court")).rejects.toMatchObject({ reason: "note" });
    await requestProfileChanges(admin, profileId, NOTE);
    const p = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: profileId } });
    expect(p.status).toBe("DRAFT");
    expect(p.reviewNote).toBe(NOTE);
    expect(await db.auditLog.count({ where: { action: "profile.request_changes", entityId: profileId } })).toBe(1);
    const [email] = await db.outboxEvent.findMany();
    expect((email.payload as { data: { note: string } }).data.note).toBe(NOTE);
  });

  it("suspension hides a published profile; reinstatement brings it back", async () => {
    await approveProfile(admin, profileId);
    await suspendProfile(admin, profileId, "Signalement en cours de vérification.");
    expect(slugs(await searchDirectory("nails", parseDirectoryQuery({})))).toEqual([]);
    await reinstateProfile(admin, profileId);
    expect((await db.providerServiceProfile.findUniqueOrThrow({ where: { id: profileId } })).status).toBe("PUBLISHED");
    expect(slugs(await searchDirectory("nails", parseDirectoryQuery({})))).toEqual(["nour-nails"]);
  });
});

describe("account decisions", () => {
  it("suspending the account hides every profile; reinstating restores them", async () => {
    await approveProfile(admin, profileId);
    await expect(setProviderStatus(admin, providerId, "suspend", "")).rejects.toMatchObject({ reason: "note" });
    await setProviderStatus(admin, providerId, "suspend", "Documents d’identité à vérifier.");
    expect(slugs(await searchDirectory("nails", parseDirectoryQuery({})))).toEqual([]);
    await expect(setProviderStatus(admin, providerId, "approve", "")).rejects.toBeInstanceOf(ReviewBlocked);
    await setProviderStatus(admin, providerId, "reinstate", "");
    expect(slugs(await searchDirectory("nails", parseDirectoryQuery({})))).toEqual(["nour-nails"]);
    const actions = (await db.auditLog.findMany({ where: { entityId: providerId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["provider.approve", "provider.suspend", "provider.reinstate"]);
  });

  it("verification needs an approved account and is audited both ways", async () => {
    await expect(setProviderVerified(admin, providerId, true)).rejects.toMatchObject({ reason: "account" });
    await setProviderStatus(admin, providerId, "approve", "");
    await setProviderVerified(admin, providerId, true);
    expect((await db.providerAccount.findUniqueOrThrow({ where: { id: providerId } })).verifiedAt).not.toBeNull();
    await setProviderVerified(admin, providerId, false);
    expect((await db.providerAccount.findUniqueOrThrow({ where: { id: providerId } })).verifiedAt).toBeNull();
    expect(await db.auditLog.count({ where: { entityId: providerId, action: { in: ["provider.verify", "provider.unverify"] } } })).toBe(2);
  });
});

describe("Botox: regulated category with private credentials", () => {
  let botoxId: string;
  let requestId: string;

  beforeEach(async () => {
    botoxId = (await db.category.findUniqueOrThrow({ where: { slug: "botox" } })).id;
    requestId = (await db.providerCategoryRequest.create({ data: { providerId, categoryId: botoxId } })).id;
  });

  it("recognises PDFs by their header only", () => {
    expect(isPdf(PDF)).toBe(true);
    expect(isPdf(Buffer.from("<html>%PDF-"))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });

  it("only accepts documents for categories the provider asked for, in private storage", async () => {
    await expect(addCredential(provider, { categorySlug: "massage", type: "diploma", issuer: null, expiresAt: null }, PDF)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addCredential(provider, { categorySlug: "botox", type: "diploma", issuer: null, expiresAt: null }, Buffer.from("<svg/>"))).rejects.toMatchObject({ reason: "type" });

    const c = await addCredential(provider, { categorySlug: "botox", type: "diploma", issuer: "Faculté de médecine d’Alger", expiresAt: null }, PDF);
    expect(c.storageKey).toMatch(new RegExp(`^credentials/${providerId}/[0-9a-f-]{36}\\.pdf$`));
    expect(await getObject("private", c.storageKey)).not.toBeNull();
    // Never reachable through the public /uploads root.
    expect(await getObject("public", c.storageKey)).toBeNull();

    const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#eee" } }).jpeg().toBuffer();
    const img = await addCredential(provider, { categorySlug: "botox", type: "license", issuer: null, expiresAt: null }, photo);
    expect(img.storageKey.endsWith(".webp")).toBe(true);
  });

  it("files open for ADMIN only, and every opening is audited", async () => {
    const c = await addCredential(provider, { categorySlug: "botox", type: "diploma", issuer: null, expiresAt: null }, PDF);
    await expect(readCredentialFile(support, c.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(readCredentialFile(provider, c.id)).rejects.toBeInstanceOf(ForbiddenError);
    const file = await readCredentialFile(admin, c.id);
    expect(file.pdf).toBe(true);
    expect(Buffer.from(file.data).equals(PDF)).toBe(true);
    expect(await db.auditLog.count({ where: { action: "credential.view", entityId: c.id, actorId: admin.id } })).toBe(1);
  });

  it("the request and the profile need an approved, unexpired credential", async () => {
    await expect(decideCategoryRequest(admin, requestId, true, "")).rejects.toMatchObject({ reason: "credential" });

    const expired = await addCredential(provider, { categorySlug: "botox", type: "license", issuer: null, expiresAt: "2020-01-01" }, PDF);
    await reviewCredential(admin, expired.id, true, null);
    expect(await hasValidCredential(providerId, botoxId)).toBe(false);
    await expect(decideCategoryRequest(admin, requestId, true, "")).rejects.toMatchObject({ reason: "credential" });

    const valid = await addCredential(provider, { categorySlug: "botox", type: "diploma", issuer: null, expiresAt: null }, PDF);
    await expect(reviewCredential(support, valid.id, true, null)).rejects.toBeInstanceOf(ForbiddenError);
    await reviewCredential(admin, valid.id, true, null);
    await decideCategoryRequest(admin, requestId, true, "");

    const draft = await db.providerServiceProfile.findFirstOrThrow({ where: { providerId, categoryId: botoxId } });
    expect(draft.status).toBe("DRAFT");
    expect(await db.auditLog.count({ where: { action: "category_request.approve", entityId: requestId } })).toBe(1);
    await expect(decideCategoryRequest(admin, requestId, false, NOTE)).rejects.toMatchObject({ reason: "state" });

    // Once the credential is revoked, the profile can no longer be published.
    const ready = await readyProfile(providerId, "massage", "nour-massage");
    await db.providerServiceProfile.update({ where: { id: draft.id }, data: { status: "PENDING_REVIEW", description: ready.description } });
    await db.portfolioMedia.create({ data: { profileId: draft.id, type: "IMAGE", storageKey: "profiles/y/c.webp", mimeType: "image/webp" } });
    await db.providerService.create({ data: { profileId: draft.id, name: "Consultation", durationMinutes: 30, priceMin: 5000 } });
    await db.workingSchedule.create({ data: { profileId: draft.id, weekday: 6, startMinute: 540, endMinute: 720 } });
    await reviewCredential(admin, valid.id, false, "Document illisible.");
    await expect(approveProfile(admin, draft.id)).rejects.toMatchObject({ reason: "credential" });
    await reviewCredential(admin, valid.id, true, null);
    await approveProfile(admin, draft.id);
  });

  it("a rejection needs a note and reaches the provider", async () => {
    await expect(decideCategoryRequest(admin, requestId, false, "non")).rejects.toMatchObject({ reason: "note" });
    await decideCategoryRequest(admin, requestId, false, NOTE);
    const r = await db.providerCategoryRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(r.status).toBe("REJECTED");
    expect(r.decisionNote).toBe(NOTE);
    expect(await db.notification.count({ where: { userId: provider.id, type: "review.category-decision" } })).toBe(1);
  });
});
