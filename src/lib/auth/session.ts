import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n/config";
import { canAccessArea, canSignIn, type Actor, type Area, type Role, type Status } from "@/server/policies/roles";
import { hashToken, newToken } from "./tokens";

export const SESSION_COOKIE = "wc_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = Actor & { fullName: string; email: string; locale: string };

function secureCookies() {
  return process.env.NODE_ENV === "production" || (process.env.APP_URL ?? "").startsWith("https://");
}

/** Keyed hash of the IP for the session list ("signed in from…"); the raw IP is not stored. */
function ipHash(ip: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(ip).digest("hex").slice(0, 32);
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown",
    userAgent: (h.get("user-agent") ?? "").slice(0, 300),
  };
}

/** Creates a session row and sets the cookie. Call only from Server Actions or Route Handlers. */
export async function startSession(userId: string) {
  const token = newToken();
  const { ip, userAgent } = await requestMeta();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt, userAgent, ipHash: ipHash(ip) } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the current session (server side) and the cookie. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revokes every session of a user (password reset, suspension, role change). */
export function revokeAllSessions(userId: string) {
  return db.session.deleteMany({ where: { userId } });
}

/** Resolves a raw session token to its user. Exported for tests; pages use getSessionUser(). */
export async function userFromSessionToken(token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, fullName: true, email: true, role: true, status: true, emailVerifiedAt: true, locale: true } },
    },
  });
  if (!session || session.expiresAt <= now) return null;
  const u = session.user;
  if (!canSignIn(u.status as Status)) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role as Role,
    status: u.status as Status,
    emailVerified: u.emailVerifiedAt !== null,
    locale: u.locale,
  };
}

/** Current user for this request (deduplicated per render). Reads cookies, so render it inside <Suspense>. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // Expiry is checked against the current time, so this must never run during a prerender.
  await connection();
  return userFromSessionToken(token);
});

/** Redirects to sign-in (with a return path) when there is no valid session. */
export async function requireUser(locale: Locale, returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/auth/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Requires a session that may open the given dashboard area; otherwise sign-in or 404 (never reveals the area). */
export async function requireArea(locale: Locale, area: Area, returnTo: string): Promise<SessionUser> {
  const user = await requireUser(locale, returnTo);
  if (!canAccessArea(user, area)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}
