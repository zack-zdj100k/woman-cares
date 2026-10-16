"use server";

import { refresh, updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { ROLES, type Role } from "@/server/policies/roles";
import { AdminBlocked, ForbiddenError, changeUserRole, setUserSuspended } from "@/server/services/admin-users";
import { moveCategory, setCategoryActive, setCategoryCredentialReview } from "@/server/services/admin-categories";
import { addCategoryPrice } from "@/server/services/admin-pricing";
import type { ReviewState } from "./actions";

const OPS = [
  "user.role",
  "user.suspend",
  "user.restore",
  "category.activate",
  "category.deactivate",
  "category.credentials.require",
  "category.credentials.waive",
  "category.up",
  "category.down",
  "price.add",
] as const;
type Op = (typeof OPS)[number];

/** Users, categories and prices. The services hold every permission rule; this only parses the form. */
export async function manageAction(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "forbidden", at: Date.now() };
  if (!rateLimit(`manage:${user.id}`, 300, 60 * 60_000).ok) return { status: "error", message: "rate", at: Date.now() };
  const op = String(form.get("op") ?? "") as Op;
  if (!(OPS as readonly string[]).includes(op)) return { status: "error", message: "forbidden", at: Date.now() };
  const id = String(form.get("id") ?? "");
  const text = (name: string, max: number) => String(form.get(name) ?? "").slice(0, max);

  try {
    let tags: string[] = [];
    switch (op) {
      case "user.role": {
        const role = text("role", 20);
        if (!(ROLES as readonly string[]).includes(role)) return { status: "error", message: "forbidden", at: Date.now() };
        tags = await changeUserRole(user, id, role as Role);
        break;
      }
      case "user.suspend":
      case "user.restore":
        tags = await setUserSuspended(user, id, op === "user.suspend", text("note", 1000));
        break;
      case "category.activate":
      case "category.deactivate":
        tags = await setCategoryActive(user, id, op === "category.activate");
        break;
      case "category.credentials.require":
      case "category.credentials.waive":
        tags = await setCategoryCredentialReview(user, id, op === "category.credentials.require");
        break;
      case "category.up":
      case "category.down":
        tags = await moveCategory(user, id, op === "category.up" ? "up" : "down");
        break;
      case "price.add":
        tags = await addCategoryPrice(user, id, text("price", 20), text("day", 10));
        break;
    }
    for (const tag of tags) updateTag(tag);
    refresh();
    return { status: "done", at: Date.now() };
  } catch (e) {
    if (e instanceof AdminBlocked) return { status: "error", message: e.reason, at: Date.now() };
    if (e instanceof ForbiddenError) return { status: "error", message: "forbidden", at: Date.now() };
    throw e;
  }
}
