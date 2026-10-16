import "server-only";
import { db } from "@/lib/db";
import { canChangeRole, canChangeStatus, type Actor, type Role } from "@/server/policies/roles";

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

async function target(id: string) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!user) throw new ForbiddenError(); // same answer as "not allowed": never reveals which ids exist
  return { id: user.id, role: user.role as Role, status: user.status };
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
}

/** Suspends or restores an account; audited; suspension signs the account out everywhere. */
export async function setUserSuspended(actor: Actor, targetId: string, suspended: boolean, reason: string) {
  const t = await target(targetId);
  if (!canChangeStatus(actor, t)) throw new ForbiddenError();
  const status = suspended ? "SUSPENDED" : "ACTIVE";
  await db.$transaction([
    db.user.update({ where: { id: t.id }, data: { status } }),
    ...(suspended ? [db.session.deleteMany({ where: { userId: t.id } })] : []),
    db.auditLog.create({
      data: { actorId: actor.id, action: suspended ? "user.suspend" : "user.restore", entityType: "User", entityId: t.id, metadata: { from: t.status, to: status, reason: reason.slice(0, 500) } },
    }),
  ]);
}
