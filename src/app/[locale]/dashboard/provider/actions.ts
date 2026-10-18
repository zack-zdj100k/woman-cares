"use server";

import { refresh, updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/validation/auth";
import {
  businessSettingsSchema,
  closureSchema,
  profileDetailsSchema,
  serviceSchema,
  weeklyScheduleSchema,
} from "@/lib/validation/provider";
import { ForbiddenError } from "@/server/services/admin-users";
import { deletePortfolioMedia, moveMedia, setCardImage, updateMediaAlt } from "@/server/services/media";
import {
  LockedError,
  addCategory,
  addClosure,
  archiveProfile,
  createService,
  deleteService,
  removeClosure,
  replaceWeeklySchedule,
  submitForReview,
  updateBusinessSettings,
  updateProfileDetails,
  updateService,
  type ChecklistItem,
} from "@/server/services/provider-profiles";

export type EditorState =
  | { status: "idle" }
  | { status: "saved"; note?: string; at: number }
  | { status: "error"; errors?: Record<string, string>; message?: string; values?: Record<string, unknown>; conflicts?: string[]; missing?: ChecklistItem[]; at: number };

/** Runs a provider mutation with session, rate limit, error mapping and cache invalidation. */
async function run(fn: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<string[] | void | EditorState>): Promise<EditorState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "session", at: Date.now() };
  if (!rateLimit(`editor:${user.id}`, 240, 60 * 60_000).ok) return { status: "error", message: "rate", at: Date.now() };
  try {
    const result = await fn(user);
    if (result && !Array.isArray(result)) return result;
    for (const tag of result ?? []) updateTag(tag);
    refresh();
    return { status: "saved", at: Date.now() };
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: "forbidden", at: Date.now() };
    if (e instanceof LockedError) return { status: "error", message: "locked", at: Date.now() };
    throw e;
  }
}

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function saveDetailsAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  const raw = { ...Object.fromEntries(form), specialties: form.getAll("specialties").map(String) };
  const parsed = profileDetailsSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values: raw, at: Date.now() };
  return run((u) => updateProfileDetails(u, str(form, "profileId"), parsed.data));
}

function parseService(form: FormData) {
  return serviceSchema.safeParse({
    name: str(form, "name"),
    description: str(form, "description"),
    durationMinutes: str(form, "durationMinutes"),
    bufferMinutes: str(form, "bufferMinutes") || "0",
    priceMin: str(form, "priceMin"),
    priceMax: str(form, "priceMax") === "" ? null : str(form, "priceMax"),
    active: form.get("active") === "on",
  });
}

export async function saveServiceAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  const parsed = parseService(form);
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values: Object.fromEntries(form), at: Date.now() };
  const serviceId = str(form, "serviceId");
  return run((u) => (serviceId ? updateService(u, serviceId, parsed.data) : createService(u, str(form, "profileId"), parsed.data)));
}

export async function deleteServiceAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  return run(async (u) => {
    const r = await deleteService(u, str(form, "serviceId"));
    for (const tag of r.tags) updateTag(tag);
    refresh();
    return { status: "saved", note: r.deactivated ? "deactivated" : undefined, at: Date.now() };
  });
}

export async function saveScheduleAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  let windows: unknown;
  try {
    windows = JSON.parse(str(form, "windows"));
  } catch {
    return { status: "error", message: "invalid", at: Date.now() };
  }
  const parsed = weeklyScheduleSchema.safeParse(windows);
  if (!parsed.success) return { status: "error", message: parsed.error.issues.some((i) => i.message === "overlap") ? "overlap" : "invalid", at: Date.now() };
  return run(async (u) => {
    const r = await replaceWeeklySchedule(u, str(form, "profileId"), parsed.data, form.get("confirm") === "1", form.has("slotMinutes") ? Number(form.get("slotMinutes")) || null : undefined);
    if (r.status === "conflicts") return { status: "error", message: "conflicts", conflicts: r.references, at: Date.now() };
    return r.tags;
  });
}

export async function addClosureAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  const parsed = closureSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), at: Date.now() };
  return run((u) => addClosure(u, str(form, "profileId"), parsed.data.from, parsed.data.to, parsed.data.note ?? null));
}

export async function removeClosureAction(form: FormData) {
  await run((u) => removeClosure(u, str(form, "exceptionId")));
}

export async function mediaAction(form: FormData) {
  const id = str(form, "mediaId");
  const op = str(form, "op");
  await run((u) => {
    switch (op) {
      case "card":
        return setCardImage(u, id);
      case "up":
        return moveMedia(u, id, -1);
      case "down":
        return moveMedia(u, id, 1);
      case "delete":
        return deletePortfolioMedia(u, id);
      case "alt":
        return updateMediaAlt(u, id, str(form, "alt"));
      default:
        throw new ForbiddenError();
    }
  });
}

export async function submitProfileAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  return run(async (u) => {
    const r = await submitForReview(u, str(form, "profileId"));
    if (r.status === "incomplete") return { status: "error", message: "incomplete", missing: r.missing, at: Date.now() };
    if (r.status === "not-draft") return { status: "error", message: "locked", at: Date.now() };
    refresh();
    return { status: "saved", note: "submitted", at: Date.now() };
  });
}

export async function saveSettingsAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  const raw = Object.fromEntries(form);
  const parsed = businessSettingsSchema.safeParse({
    ...raw,
    latitude: raw.latitude === "" ? null : raw.latitude,
    longitude: raw.longitude === "" ? null : raw.longitude,
  });
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values: raw, at: Date.now() };
  return run((u) => updateBusinessSettings(u, parsed.data));
}

export async function addCategoryAction(_prev: EditorState, form: FormData): Promise<EditorState> {
  return run(async (u) => {
    const r = await addCategory(u, str(form, "category"));
    refresh();
    return { status: "saved", note: r, at: Date.now() };
  });
}

export async function archiveProfileAction(form: FormData) {
  await run((u) => archiveProfile(u, str(form, "profileId")));
}

