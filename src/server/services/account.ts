import "server-only";
import { db } from "@/lib/db";
import { isLocale } from "@/i18n/config";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { enqueueEmail } from "./outbox";

/** The signed-in person's own account settings (any role). Email changes are not offered here. */
export class AccountBlocked extends Error {
  constructor(public reason: "name" | "phone" | "current" | "length" | "weak" | "same") {
    super(reason);
  }
}

export async function getMyAccount(actor: Actor) {
  if (!canSignIn(actor.status)) throw new ForbiddenError();
  return db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true, fullName: true, phone: true, locale: true, role: true, createdAt: true, lastLoginAt: true } });
}

export async function updateMyAccount(actor: Actor, input: { fullName: string; phone: string; locale: string }) {
  if (!canSignIn(actor.status)) throw new ForbiddenError();
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 120) throw new AccountBlocked("name");
  const phone = input.phone.trim();
  if (phone && !/^[+0-9 ().-]{6,24}$/.test(phone)) throw new AccountBlocked("phone");
  await db.user.update({ where: { id: actor.id }, data: { fullName, phone: phone || null, locale: isLocale(input.locale) ? input.locale : undefined } });
}

/** Checks the current password, sets the new one, signs out every other session and sends the security notice. */
export async function changeMyPassword(actor: Actor, current: string, next: string, keepSessionHash: string | null) {
  if (!canSignIn(actor.status)) throw new ForbiddenError();
  const u = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true, fullName: true, locale: true, passwordHash: true } });
  if (!(await verifyPassword(current, u.passwordHash))) throw new AccountBlocked("current");
  if (current === next) throw new AccountBlocked("same");
  const problem = passwordProblem(next, u.email);
  if (problem) throw new AccountBlocked(problem);
  const passwordHash = await hashPassword(next);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await tx.session.deleteMany({ where: { userId: actor.id, ...(keepSessionHash ? { tokenHash: { not: keepSessionHash } } : {}) } });
    await enqueueEmail(tx, { to: u.email, template: "password-changed", locale: isLocale(u.locale) ? u.locale : "fr", data: { name: u.fullName.split(" ")[0] }, dedupeKey: `pwchanged:${actor.id}:${Date.now()}` });
  });
}
