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

export const ROLES: readonly Role[] = ["CLIENT", "PROVIDER", "SUPPORT", "ADMIN", "SUPER_ADMIN"];

/** The roles this actor may give the target right now (empty when the actor cannot change it at all). */
export function assignableRoles(actor: Actor, target: { id: string; role: Role }) {
  return ROLES.filter((r) => canChangeRole(actor, target, r));
}

/** A suspension only applies to an account that can sign in; a restore only to a suspended one. */
export function canSuspendFrom(status: Status) {
  return status === "ACTIVE" || status === "PENDING_VERIFICATION";
}

/** User list and user files: verified staff (SUPPORT reads only). */
export function canViewUsers(actor: Actor) {
  return canSignIn(actor.status) && actor.emailVerified && isStaff(actor.role);
}

/** Categories and subscription prices: SUPPORT reads; ADMIN and above change them. */
export function canViewCatalog(actor: Actor) {
  return canViewUsers(actor);
}
export function canManageCatalog(actor: Actor) {
  return canSignIn(actor.status) && actor.emailVerified && hasStaffRank(actor.role, "ADMIN");
}

/** The audit log holds notes about people and every staff decision: ADMIN and above only. */
export function canViewAudit(actor: Actor) {
  return canManageCatalog(actor);
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

export type ProfileStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "RESTRICTED" | "SUSPENDED" | "ARCHIVED";
export type ProviderStatus = "ONBOARDING" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** Restricted, suspended or archived profiles (and suspended/rejected accounts) cannot be edited by the provider. */
export function canEditProfile(profile: ProfileStatus, account: ProviderStatus) {
  if (account === "SUSPENDED" || account === "REJECTED") return false;
  return profile === "DRAFT" || profile === "PENDING_REVIEW" || profile === "PUBLISHED";
}

/** Only drafts go to review; publishing itself is a staff decision. */
export function canSubmitProfile(profile: ProfileStatus, account: ProviderStatus) {
  return profile === "DRAFT" && canEditProfile(profile, account);
}

/** Staff (SUPPORT and above, verified) can open the review queue and read provider files. */
export function canViewModeration(actor: Actor) {
  return canSignIn(actor.status) && actor.emailVerified && isStaff(actor.role);
}

/**
 * Publication, rejection, suspension, verification and category decisions: ADMIN and above.
 * Credential documents (identity and diplomas) are also limited to ADMIN+ (least privilege).
 */
export function canReview(actor: Actor) {
  return canVerifyProvider(actor);
}

/** A profile can be published only from review, by staff, never by its owner. */
export function canPublishProfile(actor: Actor, profile: ProfileStatus) {
  return canReview(actor) && profile === "PENDING_REVIEW";
}
