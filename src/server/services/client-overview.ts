import "server-only";
import { db } from "@/lib/db";
import { publicMediaUrl } from "@/lib/storage/urls";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { publicProfileWhere } from "./discovery";

const bookingCard = {
  id: true,
  reference: true,
  startAt: true,
  status: true,
  serviceNameSnap: true,
  updatedAt: true,
  profile: { select: { slug: true, category: { select: { slug: true } }, provider: { select: { businessName: true } } } },
} as const;

/** What a client needs first: what is coming, what waits for an answer, what needs her. Her records only. */
export async function getClientOverview(actor: Actor) {
  if (actor.role !== "CLIENT") throw new ForbiddenError();
  const now = new Date();
  const mine = { clientId: actor.id };
  const [upcoming, awaiting, action, recent, favorites, notifications, counts] = await Promise.all([
    db.booking.findMany({ where: { ...mine, status: "ACCEPTED", startAt: { gte: now } }, orderBy: { startAt: "asc" }, take: 4, select: bookingCard }),
    db.booking.findMany({ where: { ...mine, status: "PENDING" }, orderBy: { startAt: "asc" }, take: 4, select: bookingCard }),
    db.booking.findMany({ where: { ...mine, status: "RESCHEDULE_PROPOSED" }, orderBy: { startAt: "asc" }, take: 4, select: { ...bookingCard, proposedStartAt: true } }),
    db.booking.findMany({ where: mine, orderBy: { updatedAt: "desc" }, take: 5, select: bookingCard }),
    db.favorite.findMany({
      where: { clientId: actor.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        profile: {
          select: {
            id: true,
            slug: true,
            status: true,
            billingVisible: true,
            category: { select: { slug: true, active: true } },
            provider: { select: { businessName: true, status: true } },
            media: { where: { isCardImage: true, type: "IMAGE" }, select: { storageKey: true }, take: 1 },
          },
        },
      },
    }),
    db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    Promise.all([
      db.booking.count({ where: { ...mine, status: "ACCEPTED", startAt: { gte: now } } }),
      db.booking.count({ where: { ...mine, status: "PENDING" } }),
      db.booking.count({ where: { ...mine, status: "COMPLETED" } }),
      db.favorite.count({ where: { clientId: actor.id } }),
    ]),
  ]);
  // A favourite whose profile is hidden or suspended shows as unavailable, without private details.
  const visibleIds = new Set(
    (await db.providerServiceProfile.findMany({ where: { ...publicProfileWhere, id: { in: favorites.map((f) => f.profile.id) } }, select: { id: true } })).map((p) => p.id),
  );
  return {
    upcoming,
    awaiting,
    action,
    recent,
    notifications,
    counts: { upcoming: counts[0], awaiting: counts[1], completed: counts[2], favorites: counts[3] },
    favorites: favorites.map((f) => {
      const available = visibleIds.has(f.profile.id);
      return {
        slug: f.profile.slug,
        category: f.profile.category.slug,
        available,
        name: available ? f.profile.provider.businessName : null,
        imageUrl: available && f.profile.media[0] ? publicMediaUrl(f.profile.media[0].storageKey) : null,
      };
    }),
  };
}
