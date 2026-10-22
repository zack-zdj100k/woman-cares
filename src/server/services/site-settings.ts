import "server-only";
import { randomUUID } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  normalizeHolder,
  normalizeRip,
  paymentDetailsAreAuthentic,
  signPaymentDetails,
  type StoredPaymentDetails,
} from "@/lib/payment-details";
import { canManageSiteSettings, canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { notifyStaff } from "./staff-alerts";

const PAYMENT_KEY = "payment.details";
const PUBLISHER_KEY = "legal.publisher";
const PASSWORD_FAILURES_BEFORE_LOCK = 5;
const LOCK_WINDOW_MS = 15 * 60_000;

export class SettingsBlocked extends Error {
  constructor(public reason: "holder" | "rip" | "password" | "locked" | "email") {
    super(reason);
  }
}

// ───────────── Where professionals send their payment ─────────────

export type PaymentDetails =
  | { status: "none" }
  | { status: "ok"; holder: string; rip: string; updatedAt: Date }
  | { status: "tampered" };

type StoredRow = StoredPaymentDetails & { sig: string; updatedById?: string };

function readStored(value: unknown): StoredRow | null {
  const v = value as Partial<StoredRow> | null;
  if (!v || typeof v.holder !== "string" || typeof v.rip !== "string" || typeof v.updatedAt !== "string" || typeof v.sig !== "string") return null;
  return { holder: v.holder, rip: v.rip, updatedAt: v.updatedAt, sig: v.sig };
}

/**
 * The account to pay, for the professionals it is meant for (and the Super Admin who sets it). A row
 * whose signature does not match was changed outside the application: it is never shown, and the
 * Super Admins are alerted (at most once a day).
 */
export async function getPaymentDetails(actor: Actor): Promise<PaymentDetails> {
  if (!canSignIn(actor.status) || !(actor.role === "PROVIDER" || canManageSiteSettings(actor))) throw new ForbiddenError();
  const row = await db.platformSetting.findUnique({ where: { key: PAYMENT_KEY } });
  if (!row) return { status: "none" };
  const stored = readStored(row.value);
  if (!stored || !paymentDetailsAreAuthentic(stored, stored.sig)) {
    await raiseTamperAlert();
    return { status: "tampered" };
  }
  return { status: "ok", holder: stored.holder, rip: stored.rip, updatedAt: new Date(stored.updatedAt) };
}

async function raiseTamperAlert() {
  try {
    const recent = await db.notification.findFirst({
      where: { type: "staff.payment-tampered", createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
      select: { id: true },
    });
    if (recent) return;
    await db.$transaction(async (tx) => {
      await notifyStaff(
        tx,
        { kind: "payment-tampered", path: "/dashboard/admin/settings", data: {}, dedupeKey: `payment-tampered:${new Date().toISOString().slice(0, 10)}` },
        ["SUPER_ADMIN"],
        ["SUPER_ADMIN"],
      );
      await tx.auditLog.create({ data: { action: "settings.payment.tampered", entityType: "PlatformSetting", entityId: PAYMENT_KEY } });
    });
  } catch {
    // An alert must never take the page down with it.
  }
}

/**
 * Saves the account. Beyond the role check it needs the Super Admin's password again: a stolen
 * session cookie alone cannot redirect the payments. Wrong passwords are counted in the journal
 * (so the limit holds across servers) and lock the form for 15 minutes after five. Every change is
 * journalled with the old and the new value, and the other Super Admins are alerted.
 */
export async function setPaymentDetails(actor: Actor, input: { holder: string; rip: string; password: string }) {
  if (!canManageSiteSettings(actor)) throw new ForbiddenError();
  const holder = normalizeHolder(input.holder);
  if (!holder) throw new SettingsBlocked("holder");
  const rip = normalizeRip(input.rip);
  if (!rip) throw new SettingsBlocked("rip");

  const failures = await db.auditLog.count({
    where: { actorId: actor.id, action: "settings.payment.password_failed", createdAt: { gte: new Date(Date.now() - LOCK_WINDOW_MS) } },
  });
  if (failures >= PASSWORD_FAILURES_BEFORE_LOCK) throw new SettingsBlocked("locked");

  const me = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true, fullName: true } });
  if (!me || !(await verifyPassword(input.password, me.passwordHash))) {
    await db.auditLog.create({ data: { actorId: actor.id, action: "settings.payment.password_failed", entityType: "PlatformSetting", entityId: PAYMENT_KEY } });
    throw new SettingsBlocked("password");
  }

  const previous = readStored((await db.platformSetting.findUnique({ where: { key: PAYMENT_KEY } }))?.value);
  const updatedAt = new Date().toISOString();
  const value = { holder, rip, updatedAt, updatedById: actor.id, sig: signPaymentDetails({ holder, rip, updatedAt }) };
  await db.$transaction(async (tx) => {
    await tx.platformSetting.upsert({ where: { key: PAYMENT_KEY }, create: { key: PAYMENT_KEY, value }, update: { value } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "settings.payment.update",
        entityType: "PlatformSetting",
        entityId: PAYMENT_KEY,
        metadata: { from: previous ? { holder: previous.holder, rip: previous.rip } : null, to: { holder, rip } },
      },
    });
    await notifyStaff(
      tx,
      { kind: "payment-details", path: "/dashboard/admin/settings", data: { client: me.fullName, reference: rip.slice(-4) }, dedupeKey: `payment-details:${randomUUID()}` },
      ["SUPER_ADMIN"],
      ["SUPER_ADMIN"],
    );
  });
}

// ───────────── Who publishes the site ─────────────

export type Publisher = { name: string; rc: string; nif: string; address: string; phone: string; email: string };
export const PUBLISHER_FIELDS = ["name", "rc", "nif", "address", "phone", "email"] as const;
const PUBLISHER_MAX: Record<(typeof PUBLISHER_FIELDS)[number], number> = { name: 120, rc: 60, nif: 60, address: 200, phone: 40, email: 120 };

/** Shown at the foot of the legal pages; null while nothing has been filled in. */
export async function getPublisher(): Promise<Publisher | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("site-settings");
  const row = await db.platformSetting.findUnique({ where: { key: PUBLISHER_KEY } });
  const v = row?.value as Partial<Publisher> | null | undefined;
  if (!v) return null;
  const clean = Object.fromEntries(PUBLISHER_FIELDS.map((f) => [f, typeof v[f] === "string" ? v[f] : ""])) as Publisher;
  return PUBLISHER_FIELDS.some((f) => clean[f]) ? clean : null;
}

/** Same read for the settings form (never cached, so it shows what was just saved). */
export async function getPublisherForEditing(actor: Actor): Promise<Publisher> {
  if (!canManageSiteSettings(actor)) throw new ForbiddenError();
  const row = await db.platformSetting.findUnique({ where: { key: PUBLISHER_KEY } });
  const v = (row?.value ?? {}) as Partial<Publisher>;
  return Object.fromEntries(PUBLISHER_FIELDS.map((f) => [f, typeof v[f] === "string" ? v[f] : ""])) as Publisher;
}

export async function setPublisher(actor: Actor, input: Publisher) {
  if (!canManageSiteSettings(actor)) throw new ForbiddenError();
  const clean = Object.fromEntries(
    PUBLISHER_FIELDS.map((f) => [f, input[f].replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, PUBLISHER_MAX[f])]),
  ) as Publisher;
  if (clean.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) throw new SettingsBlocked("email");

  const before = await getPublisherForEditing(actor);
  const empty = !PUBLISHER_FIELDS.some((f) => clean[f]);
  await db.$transaction([
    empty
      ? db.platformSetting.deleteMany({ where: { key: PUBLISHER_KEY } })
      : db.platformSetting.upsert({ where: { key: PUBLISHER_KEY }, create: { key: PUBLISHER_KEY, value: clean }, update: { value: clean } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "settings.publisher.update", entityType: "PlatformSetting", entityId: PUBLISHER_KEY, metadata: { from: before, to: clean } } }),
  ]);
  return ["site-settings"];
}
