import "server-only";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n/config";
import { categoryArt } from "@/config/categories";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { hashToken, newToken } from "@/lib/auth/tokens";
import type { ClientSignUp, ProviderSignUp } from "@/lib/validation/auth";
import { canSignIn, type Status } from "@/server/policies/roles";
import { enqueueEmail } from "./outbox";
import type { Prisma } from "@/generated/prisma/client";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
export const LOCK_AFTER_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

type Tx = Prisma.TransactionClient;

async function createVerification(tx: Tx, user: { id: string; email: string; fullName: string }, locale: Locale) {
  const token = newToken();
  const record = await tx.verificationToken.create({
    data: { userId: user.id, purpose: "EMAIL_VERIFICATION", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  await enqueueEmail(tx, {
    to: user.email,
    template: "verify-email",
    locale,
    data: { name: user.fullName.split(" ")[0], url: `${appUrl()}/${locale}/auth/verify-email?token=${token}` },
    dedupeKey: `verify:${record.id}`,
  });
}

/** Duplicate sign-ups get the same response; the real owner receives an "account exists" notice. */
async function notifyExistingAccount(email: string, locale: Locale) {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, fullName: true } });
  if (!existing) return;
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  await enqueueEmail(db, {
    to: email,
    template: "account-exists",
    locale,
    data: { name: existing.fullName.split(" ")[0], url: `${appUrl()}/${locale}/auth/sign-in` },
    dedupeKey: `exists:${existing.id}:${hourBucket}`, // at most one notice per hour
  });
}

export type SignUpResult = { status: "created"; userId: string } | { status: "duplicate" };

export async function signUpClient(input: ClientSignUp, locale: Locale): Promise<SignUpResult> {
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) {
    await notifyExistingAccount(input.email, locale);
    return { status: "duplicate" };
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          phone: input.phone,
          passwordHash,
          role: "CLIENT",
          status: "PENDING_VERIFICATION",
          locale,
          preferredWilayaCode: input.preferredWilaya,
          termsAcceptedAt: new Date(),
          preferences: { create: {} },
        },
      });
      await createVerification(tx, u, locale);
      return u;
    });
    return { status: "created", userId: user.id };
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "duplicate" }; // concurrent sign-up with the same email
    throw e;
  }
}

/** Lower-case ASCII slug: "Salon Lïna & Co" → "salon-lina-co". */
export function slugify(text: string) {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return s || "pro";
}

async function uniqueProviderSlug(tx: Tx, businessName: string) {
  const base = slugify(businessName);
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const taken = await tx.providerAccount.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * One account, one ProviderAccount, and one DRAFT profile per selected category.
 * Regulated categories (Botox) become a pending category request instead: no profile exists
 * until staff approve the credentials.
 */
export async function signUpProvider(input: ProviderSignUp, locale: Locale): Promise<SignUpResult> {
  const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) {
    await notifyExistingAccount(input.email, locale);
    return { status: "duplicate" };
  }
  const passwordHash = await hashPassword(input.password);
  const categories = await db.category.findMany({
    where: { slug: { in: input.categories }, active: true },
    select: { id: true, slug: true, requiresCredentialReview: true },
  });
  if (categories.length === 0) throw new Error("No active category selected");
  const commune = input.commune
    ? await db.commune.findFirst({
        where: { wilayaCode: input.wilaya, OR: [{ nameFr: { equals: input.commune, mode: "insensitive" } }, { nameAr: input.commune }] },
        select: { id: true },
      })
    : null;

  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          phone: input.phone,
          passwordHash,
          role: "PROVIDER",
          status: "PENDING_VERIFICATION",
          locale,
          preferredWilayaCode: input.wilaya,
          termsAcceptedAt: new Date(),
          preferences: { create: {} },
        },
      });
      const slug = await uniqueProviderSlug(tx, input.businessName);
      const account = await tx.providerAccount.create({
        data: {
          userId: u.id,
          businessName: input.businessName,
          slug,
          status: "ONBOARDING",
          workplaceType: input.workplaceType,
          wilayaCode: input.wilaya,
          communeId: commune?.id,
          locationVisibility: input.workplaceType === "HOME" ? "COMMUNE_ONLY" : "APPROXIMATE",
        },
      });
      for (const c of categories) {
        const regulated = c.requiresCredentialReview || categoryArt[c.slug as keyof typeof categoryArt]?.regulated;
        if (regulated) {
          await tx.providerCategoryRequest.create({ data: { providerId: account.id, categoryId: c.id, note: "Demande à l’inscription" } });
        } else {
          await tx.providerServiceProfile.create({
            data: { providerId: account.id, categoryId: c.id, slug: `${slug}-${c.slug}`, headline: input.businessName, status: "DRAFT" },
          });
        }
      }
      await createVerification(tx, u, locale);
      return u;
    });
    return { status: "created", userId: user.id };
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "duplicate" };
    throw e;
  }
}

export type AuthResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" | "unavailable" };

/**
 * Checks credentials with constant-ish timing (a dummy hash is verified for unknown emails),
 * locks the account for 15 minutes after 5 consecutive failures, and never says which part was wrong.
 */
export async function authenticate(email: string, password: string, now = new Date()): Promise<AuthResult> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, status: true, failedLoginCount: true, lockedUntil: true },
  });
  if (!user) {
    await verifyPassword(password, await dummyHash());
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, reason: "locked" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= LOCK_AFTER_FAILURES;
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : user.lockedUntil },
    });
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }
  if (!canSignIn(user.status as Status)) return { ok: false, reason: "unavailable" };

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
  return { ok: true, userId: user.id };
}

type TokenCheck = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" };

async function consumeToken(token: string, purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET", now: Date): Promise<TokenCheck> {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.purpose !== purpose || record.usedAt) return { ok: false, reason: "invalid" };
  if (record.expiresAt <= now) return { ok: false, reason: "expired" };
  // Single use, even under concurrent clicks: only one conditional update can succeed.
  const used = await db.verificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
  if (used.count === 0) return { ok: false, reason: "invalid" };
  return { ok: true, userId: record.userId };
}

export async function verifyEmail(token: string, now = new Date()): Promise<TokenCheck> {
  const result = await consumeToken(token, "EMAIL_VERIFICATION", now);
  if (!result.ok) return result;
  await db.user.updateMany({
    where: { id: result.userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: now },
  });
  // Only a pending account becomes active; a suspended one stays suspended.
  await db.user.updateMany({ where: { id: result.userId, status: "PENDING_VERIFICATION" }, data: { status: "ACTIVE" } });
  return result;
}

/** Sends a new verification email (previous unused links stop working). */
export async function resendVerification(userId: string, locale: Locale) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true, emailVerifiedAt: true } });
  if (!user || user.emailVerifiedAt) return false;
  await db.$transaction(async (tx) => {
    await tx.verificationToken.updateMany({ where: { userId, purpose: "EMAIL_VERIFICATION", usedAt: null }, data: { usedAt: new Date() } });
    await createVerification(tx, user, locale);
  });
  return true;
}

/** Always succeeds from the caller's point of view (no account enumeration). */
export async function requestPasswordReset(email: string, locale: Locale) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, fullName: true, status: true } });
  if (!user || !canSignIn(user.status as Status)) return;
  const token = newToken();
  await db.$transaction(async (tx) => {
    await tx.verificationToken.updateMany({ where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
    const record = await tx.verificationToken.create({
      data: { userId: user.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await enqueueEmail(tx, {
      to: user.email,
      template: "reset-password",
      locale,
      data: { name: user.fullName.split(" ")[0], url: `${appUrl()}/${locale}/auth/reset-password?token=${token}` },
      dedupeKey: `reset:${record.id}`,
    });
  });
}

export type ResetResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "length" | "weak" };

/** Sets a new password, consumes the token, signs out every session and sends a security notice. */
export async function resetPassword(token: string, password: string, locale: Locale, now = new Date()): Promise<ResetResult> {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { email: true, fullName: true } } } });
  if (!record || record.purpose !== "PASSWORD_RESET" || record.usedAt) return { ok: false, reason: "invalid" };
  if (record.expiresAt <= now) return { ok: false, reason: "expired" };
  const problem = passwordProblem(password, record.user.email);
  if (problem) return { ok: false, reason: problem };

  const consumed = await consumeToken(token, "PASSWORD_RESET", now);
  if (!consumed.ok) return consumed;
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await tx.session.deleteMany({ where: { userId: record.userId } });
    await enqueueEmail(tx, {
      to: record.user.email,
      template: "password-changed",
      locale,
      data: { name: record.user.fullName.split(" ")[0] },
      dedupeKey: `pwchanged:${record.id}`,
    });
  });
  return { ok: true };
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}
