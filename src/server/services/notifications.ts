import "server-only";
import { db } from "@/lib/db";
import { canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user's own notifications, newest first. */
export async function listMyNotifications(actor: Actor, page = 1, take = 30) {
  if (!canSignIn(actor.status)) throw new ForbiddenError();
  const [total, unread, rows] = await Promise.all([
    db.notification.count({ where: { userId: actor.id } }),
    db.notification.count({ where: { userId: actor.id, readAt: null } }),
    db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take, skip: (page - 1) * take }),
  ]);
  return { total, unread, rows, pageCount: Math.max(1, Math.ceil(total / take)) };
}

/** Marks one (or all) of the user's own notifications as read. Others' ids are ignored. */
export async function markRead(actor: Actor, id: string | "all") {
  if (!canSignIn(actor.status)) throw new ForbiddenError();
  if (id !== "all" && !UUID.test(id)) throw new ForbiddenError();
  await db.notification.updateMany({ where: { userId: actor.id, readAt: null, ...(id === "all" ? {} : { id }) }, data: { readAt: new Date() } });
}

/** Where a notification leads in the dashboards (by its type). */
export function notificationHref(locale: string, area: "client" | "provider", type: string) {
  const base = `/${locale}/dashboard/${area}`;
  if (type.startsWith("billing.")) return `${base}/subscriptions`;
  if (type.startsWith("booking.")) return area === "provider" ? `${base}/bookings` : `${base}/appointments`;
  if (type.startsWith("review.")) return `${base}/profiles`;
  return base;
}
