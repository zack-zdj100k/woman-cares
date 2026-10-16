"use server";

import { after } from "next/server";
import { refresh, updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { LockedError } from "@/server/services/provider-profiles";
import { reviewCredential } from "@/server/services/credentials";
import { deliverPendingEmails } from "@/server/services/outbox";
import {
  ReviewBlocked,
  approveProfile,
  decideCategoryRequest,
  reinstateProfile,
  requestProfileChanges,
  setProviderStatus,
  setProviderVerified,
  suspendProfile,
} from "@/server/services/review";

export type ReviewState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; message: string; at: number };

const OPS = [
  "profile.approve",
  "profile.changes",
  "profile.suspend",
  "profile.reinstate",
  "account.approve",
  "account.reject",
  "account.suspend",
  "account.reinstate",
  "account.verify",
  "account.unverify",
  "request.approve",
  "request.reject",
  "credential.approve",
  "credential.reject",
] as const;
type Op = (typeof OPS)[number];

/** One entry point for every review decision; the services enforce the ADMIN+ policy. */
export async function reviewAction(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "forbidden", at: Date.now() };
  if (!rateLimit(`review:${user.id}`, 300, 60 * 60_000).ok) return { status: "error", message: "rate", at: Date.now() };
  const op = String(form.get("op") ?? "") as Op;
  if (!(OPS as readonly string[]).includes(op)) return { status: "error", message: "forbidden", at: Date.now() };
  const id = String(form.get("id") ?? "");
  const note = String(form.get("note") ?? "").slice(0, 1000);

  try {
    let tags: string[] | void = [];
    switch (op) {
      case "profile.approve":
        tags = await approveProfile(user, id);
        break;
      case "profile.changes":
        tags = await requestProfileChanges(user, id, note);
        break;
      case "profile.suspend":
        tags = await suspendProfile(user, id, note);
        break;
      case "profile.reinstate":
        tags = await reinstateProfile(user, id);
        break;
      case "account.approve":
      case "account.reject":
      case "account.suspend":
      case "account.reinstate":
        tags = await setProviderStatus(user, id, op.split(".")[1] as "approve", note);
        break;
      case "account.verify":
      case "account.unverify":
        tags = await setProviderVerified(user, id, op === "account.verify");
        break;
      case "request.approve":
      case "request.reject":
        await decideCategoryRequest(user, id, op === "request.approve", note);
        break;
      case "credential.approve":
      case "credential.reject":
        await reviewCredential(user, id, op === "credential.approve", note || null);
        break;
    }
    for (const tag of tags ?? []) updateTag(tag);
    after(() => deliverPendingEmails().catch((e) => console.error("[outbox]", e)));
    refresh();
    return { status: "done", at: Date.now() };
  } catch (e) {
    if (e instanceof ReviewBlocked) return { status: "error", message: e.reason, at: Date.now() };
    if (e instanceof ForbiddenError) return { status: "error", message: "forbidden", at: Date.now() };
    if (e instanceof LockedError) return { status: "error", message: "account", at: Date.now() };
    throw e;
  }
}
