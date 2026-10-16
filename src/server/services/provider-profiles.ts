import "server-only";
import { db } from "@/lib/db";
import { specialtiesByCategory } from "@/config/specialties";
import type { CategorySlug } from "@/config/categories";
import { algiersParts, datesBetween } from "@/lib/time";
import type { BusinessSettings, ProfileDetails, ScheduleWindow, ServiceInput } from "@/lib/validation/provider";
import {
  canEditProfile,
  canSignIn,
  canSubmitProfile,
  type Actor,
  type ProfileStatus,
  type ProviderStatus,
} from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";

/** The profile exists and belongs to the actor, but its state does not allow this change. */
export class LockedError extends Error {
  constructor() {
    super("locked");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CacheTags = string[];

function tagsFor(p: { slug: string; status: string; provider: { slug: string }; category: { slug: string } }): CacheTags {
  // Public caches only change when the profile is visible; drafts are never cached publicly.
  return p.status === "PUBLISHED" ? ["profiles", `profile:${p.slug}`, `provider:${p.provider.slug}`, `directory:${p.category.slug}`] : [];
}

async function providerAccountOf(actor: Actor) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({ where: { userId: actor.id } });
  if (!account) throw new ForbiddenError();
  return account;
}

/**
 * Loads a profile only if it belongs to the actor (the URL id is never trusted on its own).
 * Unknown ids and other providers' profiles give the same ForbiddenError.
 */
export async function ownedProfile(actor: Actor, profileId: string, { forEdit = true } = {}) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status) || !UUID.test(profileId)) throw new ForbiddenError();
  const profile = await db.providerServiceProfile.findFirst({
    where: { id: profileId, provider: { userId: actor.id } },
    include: {
      provider: { select: { id: true, slug: true, status: true } },
      category: { select: { id: true, slug: true, requiresCredentialReview: true } },
    },
  });
  if (!profile) throw new ForbiddenError();
  if (forEdit && !canEditProfile(profile.status as ProfileStatus, profile.provider.status as ProviderStatus)) throw new LockedError();
  return profile;
}

export async function listMyProfiles(actor: Actor) {
  const account = await providerAccountOf(actor);
  return db.providerServiceProfile.findMany({
    where: { providerId: account.id },
    orderBy: { category: { sortOrder: "asc" } },
    select: {
      id: true,
      slug: true,
      status: true,
      headline: true,
      startingPrice: true,
      category: { select: { slug: true } },
      _count: { select: { services: { where: { active: true } }, media: true, schedules: true } },
    },
  });
}

/** Everything the editor needs, for the owner only. */
export async function getEditorData(actor: Actor, profileId: string) {
  const p = await ownedProfile(actor, profileId, { forEdit: false });
  const today = algiersParts(new Date()).date;
  const [services, media, schedules, exceptions] = await Promise.all([
    db.providerService.findMany({ where: { profileId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.portfolioMedia.findMany({ where: { profileId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.workingSchedule.findMany({ where: { profileId }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    db.scheduleException.findMany({ where: { profileId, date: { gte: new Date(`${today}T00:00:00Z`) } }, orderBy: { date: "asc" } }),
  ]);
  return {
    profile: p,
    editable: canEditProfile(p.status as ProfileStatus, p.provider.status as ProviderStatus),
    services,
    media,
    schedules,
    exceptions,
  };
}

export async function updateProfileDetails(actor: Actor, profileId: string, input: ProfileDetails) {
  const p = await ownedProfile(actor, profileId);
  const allowed = new Set(specialtiesByCategory[p.category.slug as CategorySlug]?.map((s) => s.slug) ?? []);
  const specialties = [...new Set(input.specialties)].filter((s) => allowed.has(s));
  const socialLinks = Object.fromEntries(
    (["instagram", "facebook", "tiktok"] as const).filter((k) => input[k]).map((k) => [k, input[k]]),
  );
  await db.providerServiceProfile.update({
    where: { id: p.id },
    data: {
      headline: input.headline,
      description: input.description,
      experienceYears: input.experienceYears ?? null,
      specialties,
      hygieneNotes: input.hygieneNotes ?? null,
      productNotes: input.productNotes ?? null,
      cancellationPolicy: input.cancellationPolicy ?? null,
      socialLinks,
    },
  });
  return tagsFor(p);
}

/** Starting price shown on cards = lowest active service price. Kept in sync after every service change. */
async function refreshStartingPrice(profileId: string) {
  const agg = await db.providerService.aggregate({ where: { profileId, active: true }, _min: { priceMin: true } });
  await db.providerServiceProfile.update({ where: { id: profileId }, data: { startingPrice: agg._min.priceMin } });
}

export const MAX_SERVICES = 40;

export async function createService(actor: Actor, profileId: string, input: ServiceInput) {
  const p = await ownedProfile(actor, profileId);
  const count = await db.providerService.count({ where: { profileId } });
  if (count >= MAX_SERVICES) throw new LockedError();
  await db.providerService.create({
    data: {
      profileId,
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      bufferMinutes: input.bufferMinutes,
      priceMin: input.priceMin,
      priceMax: input.priceMax ?? null,
      active: input.active,
      sortOrder: count,
    },
  });
  await refreshStartingPrice(profileId);
  return tagsFor(p);
}

async function ownedService(actor: Actor, serviceId: string) {
  if (!UUID.test(serviceId)) throw new ForbiddenError();
  const service = await db.providerService.findUnique({ where: { id: serviceId }, select: { id: true, profileId: true } });
  if (!service) throw new ForbiddenError();
  const p = await ownedProfile(actor, service.profileId);
  return { service, profile: p };
}

/** Editing a service never changes past bookings: they keep their own price and duration snapshots. */
export async function updateService(actor: Actor, serviceId: string, input: ServiceInput) {
  const { service, profile } = await ownedService(actor, serviceId);
  await db.providerService.update({
    where: { id: service.id },
    data: {
      name: input.name,
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      bufferMinutes: input.bufferMinutes,
      priceMin: input.priceMin,
      priceMax: input.priceMax ?? null,
      active: input.active,
    },
  });
  await refreshStartingPrice(service.profileId);
  return tagsFor(profile);
}

/** Services with booking history are deactivated instead of deleted, so history stays intact. */
export async function deleteService(actor: Actor, serviceId: string) {
  const { service, profile } = await ownedService(actor, serviceId);
  const used = await db.booking.count({ where: { serviceId: service.id } });
  if (used > 0) await db.providerService.update({ where: { id: service.id }, data: { active: false } });
  else await db.providerService.delete({ where: { id: service.id } });
  await refreshStartingPrice(service.profileId);
  return { tags: tagsFor(profile), deactivated: used > 0 };
}

const HOLDING = ["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED"] as const;

/** Future bookings that would fall outside the new weekly hours. */
export async function bookingsOutsideWindows(profileId: string, windows: ScheduleWindow[], now = new Date()) {
  const bookings = await db.booking.findMany({
    where: { profileId, status: { in: [...HOLDING] }, startAt: { gt: now } },
    select: { id: true, reference: true, startAt: true, endAt: true },
  });
  return bookings.filter((b) => {
    const start = algiersParts(b.startAt);
    const end = algiersParts(b.endAt);
    const endMinutes = end.date === start.date ? end.minutes : 1440;
    return !windows.some((w) => w.weekday === start.weekday && w.startMinute <= start.minutes && endMinutes <= w.endMinute);
  });
}

export type ScheduleResult = { status: "saved"; tags: CacheTags } | { status: "conflicts"; references: string[] };

/**
 * Replaces the weekly hours atomically. If confirmed bookings or pending requests would fall
 * outside the new hours, nothing is saved unless the provider explicitly confirms; the bookings
 * themselves are never moved or cancelled silently.
 */
export async function replaceWeeklySchedule(actor: Actor, profileId: string, windows: ScheduleWindow[], confirm = false): Promise<ScheduleResult> {
  const p = await ownedProfile(actor, profileId);
  const conflicts = await bookingsOutsideWindows(profileId, windows);
  if (conflicts.length > 0 && !confirm) return { status: "conflicts", references: conflicts.map((b) => b.reference) };
  await db.$transaction([
    db.workingSchedule.deleteMany({ where: { profileId } }),
    db.workingSchedule.createMany({ data: windows.map((w) => ({ ...w, profileId })) }),
  ]);
  return { status: "saved", tags: tagsFor(p) };
}

/** Closes every day in [from, to] (holidays, training, vacation). */
export async function addClosure(actor: Actor, profileId: string, from: string, to: string, note: string | null) {
  const p = await ownedProfile(actor, profileId);
  const today = algiersParts(new Date()).date;
  const days = datesBetween(from < today ? today : from, to);
  const existing = new Set(
    (await db.scheduleException.findMany({ where: { profileId, isClosed: true, date: { in: days.map((d) => new Date(`${d}T00:00:00Z`)) } }, select: { date: true } })).map((e) =>
      e.date.toISOString().slice(0, 10),
    ),
  );
  const toCreate = days.filter((d) => !existing.has(d));
  if (toCreate.length) {
    await db.scheduleException.createMany({ data: toCreate.map((d) => ({ profileId, date: new Date(`${d}T00:00:00Z`), isClosed: true, note })) });
  }
  return tagsFor(p);
}

export async function removeClosure(actor: Actor, exceptionId: string) {
  if (!UUID.test(exceptionId)) throw new ForbiddenError();
  const ex = await db.scheduleException.findUnique({ where: { id: exceptionId }, select: { id: true, profileId: true } });
  if (!ex) throw new ForbiddenError();
  const p = await ownedProfile(actor, ex.profileId);
  await db.scheduleException.delete({ where: { id: ex.id } });
  return tagsFor(p);
}

export type ChecklistItem = "emailVerified" | "details" | "services" | "photos" | "hours";

/** What is still missing before a profile can be sent for review. */
export async function submissionChecklist(actor: Actor, profileId: string) {
  const p = await ownedProfile(actor, profileId, { forEdit: false });
  const [services, photos, windows] = await Promise.all([
    db.providerService.count({ where: { profileId, active: true } }),
    db.portfolioMedia.count({ where: { profileId, type: "IMAGE" } }),
    db.workingSchedule.count({ where: { profileId } }),
  ]);
  const missing: ChecklistItem[] = [];
  if (!actor.emailVerified) missing.push("emailVerified");
  if (!p.headline || (p.description ?? "").length < 40) missing.push("details");
  if (services === 0) missing.push("services");
  if (photos === 0) missing.push("photos");
  if (windows === 0) missing.push("hours");
  return { profile: p, missing };
}

export type SubmitResult = { status: "submitted" } | { status: "incomplete"; missing: ChecklistItem[] } | { status: "not-draft" };

/** DRAFT → PENDING_REVIEW (and the account into review on its first submission). Audited. */
export async function submitForReview(actor: Actor, profileId: string): Promise<SubmitResult> {
  const { profile, missing } = await submissionChecklist(actor, profileId);
  if (!canSubmitProfile(profile.status as ProfileStatus, profile.provider.status as ProviderStatus)) return { status: "not-draft" };
  if (missing.length) return { status: "incomplete", missing };
  await db.$transaction([
    db.providerServiceProfile.update({ where: { id: profile.id }, data: { status: "PENDING_REVIEW" } }),
    db.providerAccount.updateMany({ where: { id: profile.provider.id, status: "ONBOARDING" }, data: { status: "PENDING_REVIEW" } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "profile.submit", entityType: "ProviderServiceProfile", entityId: profile.id } }),
  ]);
  return { status: "submitted" };
}

/** Business identity and location shared by all of the provider's category profiles. */
export async function getBusinessSettings(actor: Actor) {
  const account = await providerAccountOf(actor);
  const commune = account.communeId ? await db.commune.findUnique({ where: { id: account.communeId }, select: { nameFr: true } }) : null;
  return { ...account, communeName: commune?.nameFr ?? "" };
}

export async function updateBusinessSettings(actor: Actor, input: BusinessSettings) {
  const account = await providerAccountOf(actor);
  if (account.status === "SUSPENDED" || account.status === "REJECTED") throw new LockedError();
  const commune = input.commune
    ? await db.commune.findFirst({
        where: { wilayaCode: input.wilaya, OR: [{ nameFr: { equals: input.commune, mode: "insensitive" } }, { nameAr: input.commune }] },
        select: { id: true },
      })
    : null;
  await db.providerAccount.update({
    where: { id: account.id },
    data: {
      businessName: input.businessName,
      bio: input.bio ?? null,
      publicPhone: input.publicPhone ?? null,
      wilayaCode: input.wilaya,
      communeId: commune?.id ?? null,
      addressLine: input.addressLine ?? null,
      workplaceType: input.workplaceType,
      locationVisibility: input.locationVisibility,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });
  const profiles = await db.providerServiceProfile.findMany({
    where: { providerId: account.id, status: "PUBLISHED" },
    select: { slug: true, category: { select: { slug: true } } },
  });
  return ["profiles", `provider:${account.slug}`, ...profiles.flatMap((p) => [`profile:${p.slug}`, `directory:${p.category.slug}`])];
}

export type CategoryRequestResult = "created-profile" | "requested" | "exists";

/**
 * Adds a category to the same account. Regular categories get a DRAFT profile right away
 * (publication is still reviewed); regulated ones (Botox) become a request for staff approval.
 */
export async function addCategory(actor: Actor, categorySlug: string): Promise<CategoryRequestResult> {
  const account = await providerAccountOf(actor);
  if (account.status === "SUSPENDED" || account.status === "REJECTED") throw new LockedError();
  const category = await db.category.findFirst({ where: { slug: categorySlug, active: true } });
  if (!category) throw new ForbiddenError();
  const [profile, request] = await Promise.all([
    db.providerServiceProfile.findUnique({ where: { providerId_categoryId: { providerId: account.id, categoryId: category.id } } }),
    db.providerCategoryRequest.findFirst({ where: { providerId: account.id, categoryId: category.id, status: "PENDING" } }),
  ]);
  if (profile && profile.status !== "ARCHIVED") return "exists";
  if (request) return "exists";
  if (category.requiresCredentialReview) {
    await db.providerCategoryRequest.create({ data: { providerId: account.id, categoryId: category.id } });
    return "requested";
  }
  if (profile) {
    await db.providerServiceProfile.update({ where: { id: profile.id }, data: { status: "DRAFT" } });
  } else {
    await db.providerServiceProfile.create({
      data: { providerId: account.id, categoryId: category.id, slug: `${account.slug}-${category.slug}`, headline: account.businessName, status: "DRAFT" },
    });
  }
  return "created-profile";
}

/** Removing a category archives its profile: hidden everywhere, history and bookings kept. */
export async function archiveProfile(actor: Actor, profileId: string) {
  const p = await ownedProfile(actor, profileId, { forEdit: false });
  if (p.status === "SUSPENDED" || p.status === "RESTRICTED") throw new LockedError(); // staff decisions are not undone by archiving
  const tags = p.status === "PUBLISHED" ? tagsFor(p) : [];
  await db.$transaction([
    db.providerServiceProfile.update({ where: { id: p.id }, data: { status: "ARCHIVED" } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "profile.archive", entityType: "ProviderServiceProfile", entityId: p.id, metadata: { from: p.status } } }),
  ]);
  return tags;
}
