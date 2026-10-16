import "server-only";
import { db } from "@/lib/db";
import { canViewModeration, type Actor } from "@/server/policies/roles";

/** Badge counts for the dashboard shell. Each is scoped to what this user may see. */
export async function shellCounts(actor: Actor, area: "client" | "provider" | "admin"): Promise<{ unread: number; badges: Record<string, number> }> {
  const unread = await db.notification.count({ where: { userId: actor.id, readAt: null } });
  if (area === "provider") {
    const pending = await db.booking.count({ where: { status: "PENDING", provider: { userId: actor.id } } });
    return { unread, badges: { pending, unread } };
  }
  if (area === "admin" && canViewModeration(actor)) {
    const [review, support, payments] = await Promise.all([
      db.providerAccount.count({
        where: { OR: [{ profiles: { some: { status: "PENDING_REVIEW" } } }, { categoryRequests: { some: { status: "PENDING" } } }, { credentials: { some: { status: "PENDING" } } }] },
      }),
      db.supportRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.subscriptionPayment.count({ where: { status: "PENDING" } }),
    ]);
    return { unread: review, badges: { review, support, payments } };
  }
  if (area === "client") {
    const action = await db.booking.count({ where: { clientId: actor.id, status: "RESCHEDULE_PROPOSED" } });
    return { unread, badges: { unread, action } };
  }
  return { unread, badges: { unread } };
}
