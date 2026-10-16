import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { isLocale } from "@/i18n/config";
import { renderEmail, type EmailTemplate, type TemplateData } from "@/lib/email/templates";
import { publicMediaUrl } from "@/lib/storage/urls";
import { canReview, canViewModeration, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { LockedError } from "./provider-profiles";
import { enqueueEmail } from "./outbox";
import { hasValidCredential } from "./credentials";

/** The decision cannot be taken in the current state (the reason says why). */
export class ReviewBlocked extends Error {
  constructor(public reason: "state" | "incomplete" | "credential" | "account" | "note") {
    super(reason);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_NAMES: Record<string, { fr: string; ar: string }> = {
  coiffeuses: { fr: "Coiffure", ar: "تصفيف الشعر" },
  esthetique: { fr: "Esthétique", ar: "التجميل" },
  massage: { fr: "Massage", ar: "التدليك" },
  nails: { fr: "Ongles", ar: "الأظافر" },
  "extensions-de-cils": { fr: "Extensions de cils", ar: "تركيب الرموش" },
  botox: { fr: "Botox", ar: "البوتوكس" },
};

function requireReviewer(actor: Actor) {
  if (!canReview(actor)) throw new ForbiddenError();
}

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** In-app notification + email (outbox), both in the provider's language, inside the decision's transaction. */
async function notifyProvider(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string; fullName: string; locale: string },
  template: EmailTemplate,
  data: Omit<TemplateData, "name" | "url" | "category"> & { categorySlug?: string },
  dedupeKey: string,
) {
  const locale = isLocale(user.locale) ? user.locale : "fr";
  const full: TemplateData = {
    ...data,
    name: user.fullName.split(" ")[0],
    url: `${appUrl()}/${locale}/dashboard/provider/profiles`,
    category: data.categorySlug ? CATEGORY_NAMES[data.categorySlug]?.[locale] : undefined,
  };
  const rendered = renderEmail(template, locale, full);
  await tx.notification.create({
    data: { userId: user.id, type: `review.${template}`, title: rendered.subject, body: rendered.text.split("\n").filter(Boolean)[1] ?? rendered.subject, data: { categorySlug: data.categorySlug ?? null } },
  });
  await enqueueEmail(tx, { to: user.email, template, locale, data: full, dedupeKey });
}

function profileTags(p: { slug: string; provider: { slug: string }; category: { slug: string } }) {
  return ["profiles", `profile:${p.slug}`, `provider:${p.provider.slug}`, `directory:${p.category.slug}`];
}

async function loadProfile(profileId: string) {
  if (!UUID.test(profileId)) throw new ForbiddenError();
  const p = await db.providerServiceProfile.findUnique({
    where: { id: profileId },
    include: {
      category: { select: { id: true, slug: true, requiresCredentialReview: true } },
      provider: { select: { id: true, slug: true, status: true, user: { select: { id: true, email: true, fullName: true, locale: true, status: true, emailVerifiedAt: true } } } },
    },
  });
  if (!p) throw new ForbiddenError();
  return p;
}

// ───────────── Queue and detail (SUPPORT and above can read) ─────────────

export type QueueFilter = "pending" | "approved" | "suspended" | "rejected" | "all";
export const QUEUE_PAGE_SIZE = 25;

const pendingWhere: Prisma.ProviderAccountWhereInput = {
  OR: [
    { profiles: { some: { status: "PENDING_REVIEW" } } },
    { categoryRequests: { some: { status: "PENDING" } } },
    { credentials: { some: { status: "PENDING" } } },
  ],
};

export async function listProviderQueue(actor: Actor, filter: QueueFilter, q: string | undefined, page: number) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  const where: Prisma.ProviderAccountWhereInput = {
    AND: [
      filter === "pending"
        ? pendingWhere
        : filter === "approved"
          ? { status: "APPROVED" }
          : filter === "suspended"
            ? { status: "SUSPENDED" }
            : filter === "rejected"
              ? { status: "REJECTED" }
              : {},
      q
        ? {
            OR: [
              { businessName: { contains: q, mode: "insensitive" } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
  const [total, rows] = await Promise.all([
    db.providerAccount.count({ where }),
    db.providerAccount.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: QUEUE_PAGE_SIZE,
      skip: (page - 1) * QUEUE_PAGE_SIZE,
      select: {
        id: true,
        businessName: true,
        status: true,
        verifiedAt: true,
        createdAt: true,
        wilaya: { select: { nameFr: true, nameAr: true } },
        user: { select: { email: true, emailVerifiedAt: true } },
        _count: {
          select: {
            profiles: { where: { status: "PENDING_REVIEW" } },
            categoryRequests: { where: { status: "PENDING" } },
            credentials: { where: { status: "PENDING" } },
          },
        },
      },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE)) };
}

export async function queueCounts(actor: Actor) {
  if (!canViewModeration(actor)) throw new ForbiddenError();
  const [providers, profiles, requests, credentials] = await Promise.all([
    db.providerAccount.count({ where: pendingWhere }),
    db.providerServiceProfile.count({ where: { status: "PENDING_REVIEW" } }),
    db.providerCategoryRequest.count({ where: { status: "PENDING" } }),
    db.providerCredential.count({ where: { status: "PENDING" } }),
  ]);
  return { providers, profiles, requests, credentials };
}

/** Everything a reviewer needs on one page, including the private address (staff only). */
export async function getProviderReview(actor: Actor, providerId: string) {
  if (!canViewModeration(actor) || !UUID.test(providerId)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({
    where: { id: providerId },
    include: {
      user: { select: { id: true, email: true, phone: true, fullName: true, status: true, emailVerifiedAt: true, createdAt: true } },
      wilaya: { select: { nameFr: true, nameAr: true } },
      commune: { select: { nameFr: true } },
      profiles: {
        orderBy: { category: { sortOrder: "asc" } },
        include: {
          category: { select: { slug: true, requiresCredentialReview: true } },
          services: { where: { active: true }, orderBy: { sortOrder: "asc" } },
          media: { orderBy: { sortOrder: "asc" }, take: 12 },
          _count: { select: { schedules: true } },
        },
      },
      categoryRequests: { orderBy: { createdAt: "desc" }, include: { category: { select: { slug: true, requiresCredentialReview: true } } } },
      credentials: { orderBy: { createdAt: "desc" }, include: { category: { select: { slug: true } } } },
    },
  });
  if (!account) throw new ForbiddenError();
  const entityIds = [account.id, account.user.id, ...account.profiles.map((p) => p.id), ...account.categoryRequests.map((r) => r.id), ...account.credentials.map((c) => c.id)];
  const audit = await db.auditLog.findMany({
    where: { entityId: { in: entityIds } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: { select: { fullName: true, role: true } } },
  });
  return {
    account,
    profiles: account.profiles.map((p) => ({ ...p, mediaUrls: p.media.map((m) => ({ id: m.id, type: m.type, url: publicMediaUrl(m.storageKey) })) })),
    audit,
  };
}

// ───────────── Profile decisions (ADMIN and above) ─────────────

/**
 * PENDING_REVIEW → PUBLISHED. Re-checks completeness, the owner's account, and (for regulated
 * categories such as Botox) an approved, unexpired credential. Approves the account on first publication.
 */
export async function approveProfile(actor: Actor, profileId: string) {
  requireReviewer(actor);
  const p = await loadProfile(profileId);
  if (p.status !== "PENDING_REVIEW") throw new ReviewBlocked("state");
  const owner = p.provider.user;
  if (owner.status !== "ACTIVE" || !owner.emailVerifiedAt || p.provider.status === "SUSPENDED" || p.provider.status === "REJECTED") throw new ReviewBlocked("account");
  const [services, photos, windows] = await Promise.all([
    db.providerService.count({ where: { profileId, active: true } }),
    db.portfolioMedia.count({ where: { profileId, type: "IMAGE" } }),
    db.workingSchedule.count({ where: { profileId } }),
  ]);
  if (!services || !photos || !windows || (p.description ?? "").length < 40) throw new ReviewBlocked("incomplete");
  if (p.category.requiresCredentialReview && !(await hasValidCredential(p.provider.id, p.category.id))) throw new ReviewBlocked("credential");

  const now = new Date();
  const approvesAccount = p.provider.status === "ONBOARDING" || p.provider.status === "PENDING_REVIEW";
  await db.$transaction(async (tx) => {
    await tx.providerServiceProfile.update({ where: { id: p.id }, data: { status: "PUBLISHED", publishedAt: p.publishedAt ?? now, reviewNote: null, reviewedAt: now } });
    if (approvesAccount) {
      await tx.providerAccount.update({ where: { id: p.provider.id }, data: { status: "APPROVED", reviewNote: null } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "provider.approve", entityType: "ProviderAccount", entityId: p.provider.id, metadata: { via: "profile.approve" } } });
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "profile.approve", entityType: "ProviderServiceProfile", entityId: p.id } });
    await notifyProvider(tx, owner, "profile-published", { categorySlug: p.category.slug }, `published:${p.id}:${now.getTime()}`);
  });
  return profileTags(p);
}

/** Sends a profile under review back to DRAFT with a message for the provider. */
export async function requestProfileChanges(actor: Actor, profileId: string, note: string) {
  requireReviewer(actor);
  if (note.trim().length < 10) throw new ReviewBlocked("note");
  const p = await loadProfile(profileId);
  if (p.status !== "PENDING_REVIEW") throw new ReviewBlocked("state");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.providerServiceProfile.update({ where: { id: p.id }, data: { status: "DRAFT", reviewNote: note.trim(), reviewedAt: now } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "profile.request_changes", entityType: "ProviderServiceProfile", entityId: p.id, metadata: { note } } });
    await notifyProvider(tx, p.provider.user, "profile-changes", { categorySlug: p.category.slug, note: note.trim() }, `changes:${p.id}:${now.getTime()}`);
  });
  return [] as string[];
}

/** Hides a profile immediately (any state except archived), with the reason sent to the provider. */
export async function suspendProfile(actor: Actor, profileId: string, note: string) {
  requireReviewer(actor);
  if (note.trim().length < 10) throw new ReviewBlocked("note");
  const p = await loadProfile(profileId);
  if (p.status === "SUSPENDED" || p.status === "ARCHIVED") throw new ReviewBlocked("state");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.providerServiceProfile.update({ where: { id: p.id }, data: { status: "SUSPENDED", reviewNote: note.trim(), reviewedAt: now } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "profile.suspend", entityType: "ProviderServiceProfile", entityId: p.id, metadata: { from: p.status, note } } });
    await notifyProvider(tx, p.provider.user, "profile-suspended", { categorySlug: p.category.slug, note: note.trim() }, `suspended:${p.id}:${now.getTime()}`);
  });
  return profileTags(p);
}

/** SUSPENDED → PUBLISHED if it had been published before, otherwise back to DRAFT. */
export async function reinstateProfile(actor: Actor, profileId: string) {
  requireReviewer(actor);
  const p = await loadProfile(profileId);
  if (p.status !== "SUSPENDED") throw new ReviewBlocked("state");
  const next = p.publishedAt ? "PUBLISHED" : "DRAFT";
  await db.$transaction([
    db.providerServiceProfile.update({ where: { id: p.id }, data: { status: next, reviewNote: null, reviewedAt: new Date() } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "profile.reinstate", entityType: "ProviderServiceProfile", entityId: p.id, metadata: { to: next } } }),
  ]);
  return profileTags(p);
}

// ───────────── Account decisions ─────────────

export type AccountAction = "approve" | "reject" | "suspend" | "reinstate";
const TRANSITIONS: Record<AccountAction, { from: string[]; to: "APPROVED" | "REJECTED" | "SUSPENDED"; outcome: TemplateData["outcome"]; needsNote: boolean }> = {
  approve: { from: ["ONBOARDING", "PENDING_REVIEW"], to: "APPROVED", outcome: "approved", needsNote: false },
  reject: { from: ["ONBOARDING", "PENDING_REVIEW"], to: "REJECTED", outcome: "rejected", needsNote: true },
  suspend: { from: ["APPROVED", "ONBOARDING", "PENDING_REVIEW"], to: "SUSPENDED", outcome: "suspended", needsNote: true },
  reinstate: { from: ["SUSPENDED", "REJECTED"], to: "APPROVED", outcome: "reinstated", needsNote: false },
};

/** Account status changes. Suspension hides every profile at once (public queries require APPROVED). */
export async function setProviderStatus(actor: Actor, providerId: string, action: AccountAction, note: string) {
  requireReviewer(actor);
  if (!UUID.test(providerId)) throw new ForbiddenError();
  const rule = TRANSITIONS[action];
  if (rule.needsNote && note.trim().length < 10) throw new ReviewBlocked("note");
  const account = await db.providerAccount.findUnique({
    where: { id: providerId },
    include: { user: { select: { id: true, email: true, fullName: true, locale: true } }, profiles: { select: { slug: true, category: { select: { slug: true } } } } },
  });
  if (!account) throw new ForbiddenError();
  if (!rule.from.includes(account.status)) throw new ReviewBlocked("state");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.providerAccount.update({ where: { id: account.id }, data: { status: rule.to, reviewNote: rule.needsNote ? note.trim() : null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `provider.${action}`, entityType: "ProviderAccount", entityId: account.id, metadata: { from: account.status, note: note || null } } });
    await notifyProvider(tx, account.user, "account-update", { outcome: rule.outcome, note: rule.needsNote ? note.trim() : null }, `account:${account.id}:${action}:${now.getTime()}`);
  });
  return ["profiles", `provider:${account.slug}`, ...account.profiles.flatMap((p) => [`profile:${p.slug}`, `directory:${p.category.slug}`])];
}

/** The "verified" badge. Only for approved accounts; a provider can never set it. */
export async function setProviderVerified(actor: Actor, providerId: string, verified: boolean) {
  requireReviewer(actor);
  if (!UUID.test(providerId)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({ where: { id: providerId }, include: { profiles: { select: { slug: true, category: { select: { slug: true } } } } } });
  if (!account) throw new ForbiddenError();
  if (verified && account.status !== "APPROVED") throw new ReviewBlocked("account");
  await db.$transaction([
    db.providerAccount.update({ where: { id: account.id }, data: { verifiedAt: verified ? new Date() : null } }),
    db.auditLog.create({ data: { actorId: actor.id, action: verified ? "provider.verify" : "provider.unverify", entityType: "ProviderAccount", entityId: account.id } }),
  ]);
  return ["profiles", `provider:${account.slug}`, ...account.profiles.flatMap((p) => [`profile:${p.slug}`, `directory:${p.category.slug}`])];
}

// ───────────── Category requests ─────────────

/**
 * Approving creates (or reactivates) a DRAFT profile for that category on the same account.
 * Regulated categories need an approved, unexpired credential first.
 */
export async function decideCategoryRequest(actor: Actor, requestId: string, approve: boolean, note: string) {
  requireReviewer(actor);
  if (!UUID.test(requestId)) throw new ForbiddenError();
  const request = await db.providerCategoryRequest.findUnique({
    where: { id: requestId },
    include: { category: true, provider: { include: { user: { select: { id: true, email: true, fullName: true, locale: true } } } } },
  });
  if (!request) throw new ForbiddenError();
  if (request.status !== "PENDING") throw new ReviewBlocked("state");
  if (!approve && note.trim().length < 10) throw new ReviewBlocked("note");
  if (request.provider.status === "SUSPENDED" || request.provider.status === "REJECTED") throw new LockedError();
  if (approve && request.category.requiresCredentialReview && !(await hasValidCredential(request.providerId, request.categoryId))) throw new ReviewBlocked("credential");

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.providerCategoryRequest.update({
      where: { id: request.id },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedById: actor.id, decidedAt: now, decisionNote: note.trim() || null },
    });
    if (approve) {
      const existing = await tx.providerServiceProfile.findUnique({ where: { providerId_categoryId: { providerId: request.providerId, categoryId: request.categoryId } } });
      if (existing) await tx.providerServiceProfile.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
      else
        await tx.providerServiceProfile.create({
          data: { providerId: request.providerId, categoryId: request.categoryId, slug: `${request.provider.slug}-${request.category.slug}`, headline: request.provider.businessName, status: "DRAFT" },
        });
    }
    await tx.auditLog.create({
      data: { actorId: actor.id, action: approve ? "category_request.approve" : "category_request.reject", entityType: "ProviderCategoryRequest", entityId: request.id, metadata: { category: request.category.slug, note: note || null } },
    });
    await notifyProvider(
      tx,
      request.provider.user,
      "category-decision",
      { categorySlug: request.category.slug, outcome: approve ? "approved" : "rejected", note: note.trim() || null },
      `category:${request.id}`,
    );
  });
}
