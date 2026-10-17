"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { ROLES, type Role } from "@/server/policies/roles";
import { AdminBlocked, ForbiddenError, changeUserRole, setUserSuspended } from "@/server/services/admin-users";
import { moveCategory, setCategoryActive, setCategoryCredentialReview } from "@/server/services/admin-categories";
import { addCategoryPrice, deleteCategoryPrice } from "@/server/services/admin-pricing";
import { deleteMessage, setMessageStatus } from "@/server/services/messages";
import { deleteAuditEntry, deleteCategory, deleteInvoice, deletePayment, deleteProvider, deleteSubscription, deleteUser } from "@/server/services/admin-delete";
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
  "price.delete",
  "message.status",
  "message.delete",
  "user.delete",
  "provider.delete",
  "category.delete",
  "subscription.delete",
  "invoice.delete",
  "payment.delete",
  "audit.delete",
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
      case "price.delete":
        tags = await deleteCategoryPrice(user, id);
        break;
      case "message.status": {
        const status = text("status", 20);
        if (status !== "OPEN" && status !== "IN_PROGRESS" && status !== "RESOLVED") return { status: "error", message: "forbidden", at: Date.now() };
        await setMessageStatus(user, id, status);
        break;
      }
      case "message.delete":
        await deleteMessage(user, id);
        break;
      case "user.delete":
        tags = await deleteUser(user, id);
        break;
      case "provider.delete":
        tags = await deleteProvider(user, id);
        break;
      case "category.delete":
        tags = await deleteCategory(user, id);
        break;
      case "subscription.delete":
        tags = await deleteSubscription(user, id);
        break;
      case "invoice.delete":
        tags = await deleteInvoice(user, id);
        break;
      case "payment.delete":
        tags = await deletePayment(user, id);
        break;
      case "audit.delete":
        tags = await deleteAuditEntry(user, id);
        break;
    }
    for (const tag of tags) updateTag(tag);
    // After deleting the record a page is about, go back to its list.
    const next = text("next", 200);
    if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
    refresh();
    return { status: "done", at: Date.now() };
  } catch (e) {
    if (e instanceof AdminBlocked) return { status: "error", message: e.reason, at: Date.now() };
    if (e instanceof ForbiddenError) return { status: "error", message: "forbidden", at: Date.now() };
    throw e;
  }
}
