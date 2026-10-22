import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Rules for the account professionals send their subscription payment to. Pure functions: the
 * rules (what is accepted, how it is shown) and the signature that makes the stored value
 * tamper-evident. The database row is only trusted when its signature checks out.
 */
export const RIP_MIN_DIGITS = 10;
export const RIP_MAX_DIGITS = 24;

/** Digits only: spaces, dots, dashes and slashes people type between groups are dropped. */
export function normalizeRip(raw: string): string | null {
  const digits = raw.replace(/[\s.\-_/]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  return digits.length >= RIP_MIN_DIGITS && digits.length <= RIP_MAX_DIGITS ? digits : null;
}

/** 20 digits read as bank 3 | agency 5 | account 10 | key 2; anything else in blocks of four. */
export function formatRip(digits: string) {
  if (digits.length === 20) return [digits.slice(0, 3), digits.slice(3, 8), digits.slice(8, 18), digits.slice(18)].join(" ");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** A person or business name: control characters and angle brackets removed, spaces collapsed. */
export function normalizeHolder(raw: string): string | null {
  const value = raw.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return value.length >= 2 && value.length <= 80 ? value : null;
}

export type StoredPaymentDetails = { holder: string; rip: string; updatedAt: string };

function signingKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is required to sign the payment details.");
  // Domain separation: this key only ever signs payment details, whatever else AUTH_SECRET is used for.
  return createHmac("sha256", secret ?? "development-only").update("woman-cares:payment-details:v1").digest();
}

export function signPaymentDetails(d: StoredPaymentDetails) {
  return createHmac("sha256", signingKey()).update(`v1\n${d.holder}\n${d.rip}\n${d.updatedAt}`).digest("hex");
}

export function paymentDetailsAreAuthentic(d: StoredPaymentDetails, signature: unknown) {
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signPaymentDetails(d), "hex"));
}
