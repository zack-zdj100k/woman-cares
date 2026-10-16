"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { canReview } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { BillingBlocked, declarePayment, recordPayment, runBillingCycle, setSubscriptionTerms, verifyPayment } from "@/server/services/billing";
import { deliverPendingEmails } from "@/server/services/outbox";

export type BillingState = { status: "idle" } | { status: "done"; at: number; info?: string } | { status: "error"; code: string };

const METHODS = ["MANUAL_TRANSFER", "CCP", "BARIDIMOB", "CASH"] as const;
type Method = (typeof METHODS)[number];
const method = (v: FormDataEntryValue | null): Method => (METHODS.includes(v as Method) ? (v as Method) : "MANUAL_TRANSFER");

async function run(fn: () => Promise<unknown>, info?: () => string): Promise<BillingState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof BillingBlocked) return { status: "error", code: e.reason };
    if (e instanceof ForbiddenError) return { status: "error", code: "forbidden" };
    throw e;
  }
  after(() => deliverPendingEmails().catch(() => {}));
  updateTag("profiles");
  refresh();
  return { status: "done", at: Date.now(), info: info?.() };
}

/** Admin: a professional's billing terms (standard, agreed monthly price, exemption). */
export async function setTermsAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  const basis = String(form.get("basis"));
  if (basis !== "PER_CATEGORY" && basis !== "NEGOTIATED" && basis !== "EXEMPT") return { status: "error", code: "generic" };
  const raw = String(form.get("amount") ?? "").replace(/[\s .]/g, "");
  const amount = raw ? Number(raw) : null;
  return run(() => setSubscriptionTerms(user, String(form.get("providerId") ?? ""), { basis, negotiatedPrice: amount, reason: String(form.get("reason") ?? "") || null }));
}

export async function verifyPaymentAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  return run(() => verifyPayment(user, String(form.get("paymentId") ?? ""), form.get("decision") === "verify", String(form.get("note") ?? "") || null));
}

export async function recordPaymentAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  return run(() => recordPayment(user, String(form.get("invoiceId") ?? ""), { method: method(form.get("method")), reference: String(form.get("reference") ?? "") }));
}

export async function runCycleAction(): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canReview(user)) return { status: "error", code: "forbidden" };
  if (!rateLimit(`billing-cycle:${user.id}`, 6, 60_000).ok) return { status: "error", code: "generic" };
  let r = { invoices: 0, changed: 0 };
  const state = await run(async () => {
    r = await runBillingCycle();
  });
  return state.status === "done" ? { ...state, info: `${r.invoices}:${r.changed}` } : state;
}

/** Professional: declare a transfer for one of her invoices. */
export async function declarePaymentAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  if (!rateLimit(`declare:${user.id}`, 10, 60 * 60_000).ok) return { status: "error", code: "generic" };
  return run(() =>
    declarePayment(user, String(form.get("invoiceId") ?? ""), {
      method: method(form.get("method")),
      reference: String(form.get("reference") ?? ""),
      note: String(form.get("note") ?? "") || null,
      idempotencyKey: String(form.get("key") ?? ""),
    }),
  );
}
