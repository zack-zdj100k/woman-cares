import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  assignableRoles,
  canChangeRole,
  canChangeStatus,
  canSuspendFrom,
  canViewAudit,
  canViewUsers,
  type Actor,
  type Role,
  type Status,
} from "@/server/policies/roles";

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

/** The change is allowed for this actor but not in the current state (the reason says why). */
export class AdminBlocked extends Error {
  constructor(public reason: "state" | "note" | "date" | "price" | "order" | "last" | "self" | "inUse" | "lastAdmin") {
    super(reason);
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function target(id: string) {
  if (!UUID.test(id)) throw new ForbiddenError();
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true, emailVerifiedAt: true, provider: { select: { slug: true, profiles: { select: { slug: true, category: { select: { slug: true } } } } } } },
  });
  if (!user) throw new ForbiddenError(); // same answer as "not allowed": never reveals which ids exist
  return { id: user.id, role: user.role as Role, status: user.status as Status, emailVerifiedAt: user.emailVerifiedAt, provider: user.provider };
}

/** Public pages show a professional only while her own account is active: changes to it refresh those pages. */
function providerTags(provider: Awaited<ReturnType<typeof target>>["provider"]) {
  if (!provider) return [];
  return ["profiles", `provider:${provider.slug}`, ...provider.profiles.flatMap((p) => [`profile:${p.slug}`, `directory:${p.category.slug}`])];
}

/** Changes a role after the policy check; audited; the target's sessions are revoked so the new role applies at once. */
export async function changeUserRole(actor: Actor, targetId: string, next: Role) {
  const t = await target(targetId);
  if (!canChangeRole(actor, t, next)) throw new ForbiddenError();
  await db.$transaction([
    db.user.update({ where: { id: t.id }, data: { role: next } }),
    db.session.deleteMany({ where: { userId: t.id } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "user.role.change", entityType: "User", entityId: t.id, metadata: { from: t.role, to: next } } }),
  ]);
  return providerTags(t.provider);
}

/**
 * Suspends or restores an account; audited; suspension signs the account out everywhere and hides
 * a professional's profiles. A restored account goes back to the status it had before the
 * suspension (from the audit trail); without that record, ACTIVE when the email was confirmed,
 * otherwise PENDING_VERIFICATION.
 */
export async function setUserSuspended(actor: Actor, targetId: string, suspended: boolean, reason: string) {
  const t = await target(targetId);
  if (!canChangeStatus(actor, t)) throw new ForbiddenError();
  if (suspended ? !canSuspendFrom(t.status) : t.status !== "SUSPENDED") throw new AdminBlocked("state");
  if (suspended && reason.trim().length < 10) throw new AdminBlocked("note");
  let status: "SUSPENDED" | "ACTIVE" | "PENDING_VERIFICATION" = suspended ? "SUSPENDED" : t.emailVerifiedAt ? "ACTIVE" : "PENDING_VERIFICATION";
  if (!suspended) {
    const last = await db.auditLog.findFirst({ where: { action: "user.suspend", entityType: "User", entityId: t.id }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
    const before = (last?.metadata as { from?: string } | null)?.from;
    if (before === "ACTIVE" || before === "PENDING_VERIFICATION") status = before;
  }
  await db.$transaction([
    db.user.update({ where: { id: t.id }, data: { status } }),
    ...(suspended ? [db.session.deleteMany({ where: { userId: t.id } })] : []),
    db.auditLog.create({
      data: { actorId: actor.id, action: suspended ? "user.suspend" : "user.restore", entityType: "User", entityId: t.id, metadata: { from: t.status, to: status, reason: reason.trim().slice(0, 500) } },
    }),
  ]);
  return providerTags(t.provider);
}

// ───────────── Reads (SUPPORT and above) ─────────────

export const USERS_PAGE_SIZE = 25;
export type UserFilters = { q?: string; role?: Role; status?: Status; page: number };

export async function listUsers(actor: Actor, f: UserFilters) {
  if (!canViewUsers(actor)) throw new ForbiddenError();
  const where: Prisma.UserWhereInput = {
    AND: [
      f.role ? { role: f.role } : {},
      f.status ? { status: f.status } : {},
      f.q ? { OR: [{ fullName: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] } : {},
    ],
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: USERS_PAGE_SIZE,
      skip: (f.page - 1) * USERS_PAGE_SIZE,
      select: { id: true, fullName: true, email: true, role: true, status: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

/** One account: identity, sign-in facts, linked professional account, what this actor may change, and (ADMIN+) its history. */
export async function getUserDetail(actor: Actor, userId: string) {
  if (!canViewUsers(actor) || !UUID.test(userId)) throw new ForbiddenError();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      locale: true,
      emailVerifiedAt: true,
      createdAt: true,
      lastLoginAt: true,
      lockedUntil: true,
      provider: { select: { id: true, businessName: true, status: true } },
      _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } }, bookings: true } },
    },
  });
  if (!user) throw new ForbiddenError();
  const self = { id: user.id, role: user.role as Role };
  const history = canViewAudit(actor)
    ? await db.auditLog.findMany({
        where: { entityType: "User", entityId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { fullName: true, role: true } } },
      })
    : null;
  return {
    user,
    roles: assignableRoles(actor, self),
    canSuspend: canChangeStatus(actor, self) && canSuspendFrom(user.status as Status),
    canRestore: canChangeStatus(actor, self) && user.status === "SUSPENDED",
    history,
  };
}

/**
 * Confirms an account's email on the person's behalf (ADMIN and above), for example when the
 * confirmation email never arrived. An account waiting for that confirmation becomes ACTIVE. Audited.
 */
export async function confirmEmailManually(actor: Actor, targetId: string) {
  const { canReview } = await import("@/server/policies/roles");
  if (!canReview(actor) || !UUID.test(targetId)) throw new ForbiddenError();
  const t = await db.user.findUnique({ where: { id: targetId }, select: { id: true, status: true, emailVerifiedAt: true, provider: { select: { slug: true, profiles: { select: { slug: true, category: { select: { slug: true } } } } } } } });
  if (!t) throw new ForbiddenError();
  if (t.emailVerifiedAt) throw new AdminBlocked("state");
  await db.$transaction([
    db.user.update({ where: { id: t.id }, data: { emailVerifiedAt: new Date(), ...(t.status === "PENDING_VERIFICATION" ? { status: "ACTIVE" } : {}) } }),
    db.verificationToken.deleteMany({ where: { userId: t.id, purpose: "EMAIL_VERIFICATION" } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "user.email.confirm", entityType: "User", entityId: t.id, metadata: { from: t.status } } }),
  ]);
  return t.provider ? ["profiles", `provider:${t.provider.slug}`, ...t.provider.profiles.flatMap((p) => [`profile:${p.slug}`, `directory:${p.category.slug}`])] : [];
}
