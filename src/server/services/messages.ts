import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canReadMessages, type Actor } from "@/server/policies/roles";
import { ForbiddenError, UUID } from "./admin-users";

/**
 * Messages sent from the public contact form (SupportRequest). Only the Super Admins read, sort and
 * delete them; every status change and deletion is audited.
 */
export type MessageFilter = "new" | "progress" | "done" | "all";
const PAGE = 20;
const where: Record<MessageFilter, Prisma.SupportRequestWhereInput> = {
  new: { status: "OPEN" },
  progress: { status: "IN_PROGRESS" },
  done: { status: { in: ["RESOLVED", "CLOSED"] } },
  all: {},
};

export async function listMessages(actor: Actor, filter: MessageFilter, page: number) {
  if (!canReadMessages(actor)) throw new ForbiddenError();
  const [total, rows, counts] = await Promise.all([
    db.supportRequest.count({ where: where[filter] }),
    db.supportRequest.findMany({ where: where[filter], orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    Promise.all((["new", "progress", "done", "all"] as const).map((f) => db.supportRequest.count({ where: where[f] }))),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / PAGE)), counts: { new: counts[0], progress: counts[1], done: counts[2], all: counts[3] } };
}

export async function setMessageStatus(actor: Actor, id: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED") {
  if (!canReadMessages(actor) || !UUID.test(id)) throw new ForbiddenError();
  const m = await db.supportRequest.findUnique({ where: { id }, select: { status: true } });
  if (!m) throw new ForbiddenError();
  await db.$transaction([
    db.supportRequest.update({ where: { id }, data: { status, assignedToId: status === "OPEN" ? null : actor.id } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "message.status", entityType: "SupportRequest", entityId: id, metadata: { from: m.status, to: status } } }),
  ]);
}

export async function deleteMessage(actor: Actor, id: string) {
  if (!canReadMessages(actor) || !UUID.test(id)) throw new ForbiddenError();
  const m = await db.supportRequest.findUnique({ where: { id }, select: { subject: true, email: true } });
  if (!m) throw new ForbiddenError();
  await db.$transaction([
    db.supportRequest.delete({ where: { id } }),
    db.notification.deleteMany({ where: { type: "staff.contact", data: { path: ["path"], equals: `/dashboard/admin/messages?open=${id}` } } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "message.delete", entityType: "SupportRequest", entityId: id, metadata: { subject: m.subject } } }),
  ]);
}
