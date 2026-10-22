"use server";

import { refresh, updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { canManageSiteSettings } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { PUBLISHER_FIELDS, SettingsBlocked, setPaymentDetails, setPublisher, type Publisher } from "@/server/services/site-settings";
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

export type SettingsFormState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; code: string };

/** Where professionals send their payment. Super Admin only, and the password is asked again. */
export async function savePaymentDetailsAction(_p: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const user = await getSessionUser();
  if (!user || !canManageSiteSettings(user)) return { status: "error", code: "forbidden" };
  if (!rateLimit(`payment-details:${user.id}`, 10, 15 * 60_000).ok) return { status: "error", code: "rate" };
  try {
    await setPaymentDetails(user, {
      holder: String(form.get("holder") ?? ""),
      rip: String(form.get("rip") ?? ""),
      password: String(form.get("password") ?? ""),
    });
  } catch (e) {
    if (e instanceof SettingsBlocked) return { status: "error", code: e.reason };
    if (e instanceof ForbiddenError) return { status: "error", code: "forbidden" };
    throw e;
  }
  refresh();
  return { status: "done", at: Date.now() };
}

/** Who publishes the site, shown on the legal pages. Super Admin only. */
export async function savePublisherAction(_p: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const user = await getSessionUser();
  if (!user || !canManageSiteSettings(user)) return { status: "error", code: "forbidden" };
  const input = Object.fromEntries(PUBLISHER_FIELDS.map((f) => [f, String(form.get(f) ?? "")])) as Publisher;
  try {
    for (const tag of await setPublisher(user, input)) updateTag(tag);
  } catch (e) {
    if (e instanceof SettingsBlocked) return { status: "error", code: e.reason };
    if (e instanceof ForbiddenError) return { status: "error", code: "forbidden" };
    throw e;
  }
  refresh();
  return { status: "done", at: Date.now() };
}
