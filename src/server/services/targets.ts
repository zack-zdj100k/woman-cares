import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canDelete, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";

/**
 * Reference rates the Super Admin sets for the professionals' statistics. "Higher is better" for the
 * request and acceptance rates (a minimum to reach); "lower is better" for expiry, no-show and
 * cancellation (a maximum not to exceed). Stored as fractions (0.05 = 5 %); null = no target.
 */
export const TARGET_KEYS = ["conversion", "acceptance", "expiry", "noShow", "cancellation"] as const;
export type TargetKey = (typeof TARGET_KEYS)[number];
export type Targets = Record<TargetKey, number | null>;
export const HIGHER_IS_BETTER: Record<TargetKey, boolean> = { conversion: true, acceptance: true, expiry: false, noShow: false, cancellation: false };

const KEY = "analytics.targets";

export async function getTargets(): Promise<Targets> {
  const row = await db.platformSetting.findUnique({ where: { key: KEY } });
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return Object.fromEntries(TARGET_KEYS.map((k) => [k, typeof v[k] === "number" && (v[k] as number) >= 0 && (v[k] as number) <= 1 ? (v[k] as number) : null])) as Targets;
}

/** Super Admin only; audited. */
export async function setTargets(actor: Actor, targets: Targets) {
  if (!canDelete(actor)) throw new ForbiddenError();
  for (const k of TARGET_KEYS) {
    const v = targets[k];
    if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 1)) throw new ForbiddenError();
  }
  const before = await getTargets();
  await db.$transaction([
    db.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: targets as Prisma.InputJsonValue }, update: { value: targets as Prisma.InputJsonValue } }),
    db.auditLog.create({ data: { actorId: actor.id, action: "analytics.targets.set", entityType: "PlatformSetting", entityId: KEY, metadata: { before, after: targets } as Prisma.InputJsonValue } }),
  ]);
}

/** Whether a rate meets its target (null when either is missing). */
export function meetsTarget(key: TargetKey, value: number | null, target: number | null) {
  if (value === null || target === null) return null;
  return HIGHER_IS_BETTER[key] ? value >= target : value <= target;
}
