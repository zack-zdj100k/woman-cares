import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { addDays } from "@/lib/availability";
import { algiersMidnight, isIsoDay } from "@/lib/pricing-dates";
import { canViewAudit, type Actor } from "@/server/policies/roles";
import { ForbiddenError, UUID } from "./admin-users";

export const AUDIT_PAGE_SIZE = 50;
/** Entries written without a signed-in person (bootstrap CLI, background jobs). */
export const SYSTEM_ACTOR = "system";

export type AuditFilters = { action?: string; actor?: string; entityType?: string; from?: string; to?: string; page: number };

/** Read-only browser over the audit log, newest first. ADMIN and above; the log itself is append-only. */
export async function listAuditLog(actor: Actor, f: AuditFilters) {
  if (!canViewAudit(actor)) throw new ForbiddenError();
  const from = f.from && isIsoDay(f.from) ? algiersMidnight(f.from) : undefined;
  const to = f.to && isIsoDay(f.to) ? algiersMidnight(addDays(f.to, 1)) : undefined; // inclusive end day
  const where: Prisma.AuditLogWhereInput = {
    ...(f.action ? { action: f.action } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.actor === SYSTEM_ACTOR ? { actorId: null } : f.actor && UUID.test(f.actor) ? { actorId: f.actor } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: AUDIT_PAGE_SIZE,
      skip: (f.page - 1) * AUDIT_PAGE_SIZE,
      select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { id: true, fullName: true, email: true, role: true } } },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

/** Values for the filter menus, taken from the log itself so every option returns something. */
export async function auditFilterOptions(actor: Actor) {
  if (!canViewAudit(actor)) throw new ForbiddenError();
  const [actions, types, actors] = await Promise.all([
    db.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    db.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
    db.auditLog.groupBy({ by: ["actorId"] }),
  ]);
  const ids = actors.map((a) => a.actorId).filter((id): id is string => id !== null);
  const people = await db.user.findMany({ where: { id: { in: ids } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, role: true } });
  return {
    actions: actions.map((a) => a.action),
    entityTypes: types.map((t) => t.entityType),
    actors: people,
    hasSystem: actors.some((a) => a.actorId === null),
  };
}
