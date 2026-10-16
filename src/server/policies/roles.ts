/**
 * Role and permission rules. Pure functions: no I/O, exhaustively unit-tested.
 * The server is the only place these decisions are made; the UI may hide things, never enforce them.
 */
export type Role = "CLIENT" | "PROVIDER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
export type Status = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type Actor = { id: string; role: Role; status: Status; emailVerified: boolean };

const STAFF_RANK: Partial<Record<Role, number>> = { SUPPORT: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function isStaff(role: Role) {
  return role in STAFF_RANK;
}

/** True when the role is at least `min` in the staff hierarchy (SUPPORT < ADMIN < SUPER_ADMIN). */
export function hasStaffRank(role: Role, min: "SUPPORT" | "ADMIN" | "SUPER_ADMIN") {
  return (STAFF_RANK[role] ?? 0) >= STAFF_RANK[min]!;
}

/** Can this account sign in at all? */
export function canSignIn(status: Status) {
  return status === "ACTIVE" || status === "PENDING_VERIFICATION";
}

/** Which dashboard area an account may open. */
export type Area = "client" | "provider" | "admin";
export function canAccessArea(actor: Actor, area: Area) {
  if (!canSignIn(actor.status)) return false;
  switch (area) {
    case "client":
      return actor.role === "CLIENT";
    case "provider":
      return actor.role === "PROVIDER";
    case "admin":
      return isStaff(actor.role) && actor.emailVerified;
  }
}

/** Where to send someone right after signing in. */
export function homeArea(role: Role): Area {
  return isStaff(role) ? "admin" : role === "PROVIDER" ? "provider" : "client";
}

/** Requesting appointments requires a verified, active client account. */
export function canRequestAppointment(actor: Actor) {
  return actor.role === "CLIENT" && actor.status === "ACTIVE" && actor.emailVerified;
}

/**
 * Role changes:
 *  - nobody changes their own role;
 *  - granting or removing SUPPORT/ADMIN/SUPER_ADMIN requires SUPER_ADMIN;
 *  - ADMIN may only move accounts between CLIENT and PROVIDER;
 *  - SUPPORT cannot change roles.
 */
export function canChangeRole(actor: Actor, target: { id: string; role: Role }, next: Role) {
  if (!canSignIn(actor.status) || !actor.emailVerified) return false;
  if (actor.id === target.id || target.role === next) return false;
  const touchesStaff = isStaff(target.role) || isStaff(next);
  if (touchesStaff) return actor.role === "SUPER_ADMIN";
  return hasStaffRank(actor.role, "ADMIN");
}

/** Suspending or restoring accounts: staff of a strictly higher rank, or ADMIN+ for non-staff. */
export function canChangeStatus(actor: Actor, target: { id: string; role: Role }) {
  if (!canSignIn(actor.status) || !actor.emailVerified || actor.id === target.id) return false;
  if (isStaff(target.role)) return actor.role === "SUPER_ADMIN";
  return hasStaffRank(actor.role, "ADMIN");
}

/** Provider resources: only the owning provider, or staff for moderation reads. */
export function canManageProviderResource(actor: Actor, ownerUserId: string) {
  return canSignIn(actor.status) && actor.role === "PROVIDER" && actor.id === ownerUserId;
}

/** A booking is visible to its client, to the provider who owns the profile, and to staff (support work). */
export function canViewBooking(actor: Actor, booking: { clientId: string; providerUserId: string }) {
  if (!canSignIn(actor.status)) return false;
  if (actor.id === booking.clientId || actor.id === booking.providerUserId) return true;
  return isStaff(actor.role) && actor.emailVerified;
}

/** Verified status and category approvals are staff-only decisions; a provider can never grant them. */
export function canVerifyProvider(actor: Actor) {
  return canSignIn(actor.status) && actor.emailVerified && hasStaffRank(actor.role, "ADMIN");
}
