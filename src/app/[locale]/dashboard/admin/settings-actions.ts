"use server";

import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/server/services/admin-users";
import { setTargets, TARGET_KEYS, type Targets } from "@/server/services/targets";

export type TargetsState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; code: string };

/** Percentages typed by the Super Admin ("5" = 5 %; empty = no target). */
export async function setTargetsAction(_p: TargetsState, form: FormData): Promise<TargetsState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  const targets = {} as Targets;
  for (const k of TARGET_KEYS) {
    const raw = String(form.get(k) ?? "").trim().replace(",", ".");
    if (!raw) {
      targets[k] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { status: "error", code: "range" };
    targets[k] = Math.round(n * 100) / 10_000;
  }
  try {
    await setTargets(user, targets);
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", code: "forbidden" };
    throw e;
  }
  refresh();
  return { status: "done", at: Date.now() };
}
