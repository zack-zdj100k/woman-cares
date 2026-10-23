import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * The browser she signed up in waits for her confirmation. The confirmation link may open somewhere else
 * (the mail app's own browser, another phone), so this signed, httpOnly cookie lets the page she left
 * open sign her in once the address is confirmed. Only that browser holds it: it proves she is the one
 * who just chose the password. It lasts 24 hours, like the link, and is removed as soon as it is used.
 */
export const HANDOFF_COOKIE = "wc_handoff";
export const HANDOFF_TTL_MS = 24 * 3_600_000;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required to sign the sign-up handoff.");
  // Domain separation: this key only ever signs handoffs.
  return createHmac("sha256", secret ?? "development-only").update("woman-cares:signup-handoff:v1").digest();
}

const sign = (userId: string, issuedAt: number) => createHmac("sha256", key()).update(`${userId}.${issuedAt}`).digest("hex");

export function encodeHandoff(userId: string, issuedAt: number) {
  return `${userId}.${issuedAt}.${sign(userId, issuedAt)}`;
}

export function decodeHandoff(value: string | undefined, now = Date.now()): { userId: string; issuedAt: number } | null {
  const m = /^([0-9a-f-]{36})\.(\d{13})\.([0-9a-f]{64})$/.exec(value ?? "");
  if (!m) return null;
  const issuedAt = Number(m[2]);
  if (issuedAt > now + 60_000 || now - issuedAt > HANDOFF_TTL_MS) return null;
  const expected = Buffer.from(sign(m[1], issuedAt), "hex");
  if (!timingSafeEqual(expected, Buffer.from(m[3], "hex"))) return null;
  return { userId: m[1], issuedAt };
}

const secure = () => process.env.NODE_ENV === "production" || (process.env.APP_URL ?? "").startsWith("https://");

/**
 * Called after every sign-up. An address that already had an account gets a cookie of the same shape for
 * an id that exists nowhere, so the browser cannot tell the two cases apart (no account enumeration).
 */
export async function startHandoff(userId: string | null) {
  (await cookies()).set(HANDOFF_COOKIE, encodeHandoff(userId ?? randomUUID(), Date.now()), {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: HANDOFF_TTL_MS / 1000,
  });
}

export async function readHandoff() {
  return decodeHandoff((await cookies()).get(HANDOFF_COOKIE)?.value);
}

export async function endHandoff() {
  (await cookies()).delete(HANDOFF_COOKIE);
}
