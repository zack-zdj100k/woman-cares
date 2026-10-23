"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { isLocale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { canReview, canVerifyPayment } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { addMonths } from "@/lib/billing";
import { BillingBlocked, recordDirectPayment, sendInvoice, setFreeTrialForAll, startSubscription, stopTrial, recordPayment, runBillingCycle, setSubscriptionTerms, setTrialDefault, setTrialEnd, verifyPayment } from "@/server/services/billing";
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
  if (!user || !canVerifyPayment(user)) return { status: "error", code: "forbidden" };
  return run(() => verifyPayment(user, String(form.get("paymentId") ?? ""), form.get("decision") === "verify", String(form.get("note") ?? "") || null));
}

export async function recordPaymentAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canVerifyPayment(user)) return { status: "error", code: "forbidden" };
  const day = String(form.get("paidOn") ?? "");
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00+01:00`) : null;
  return run(() => recordPayment(user, String(form.get("invoiceId") ?? ""), { method: method(form.get("method")), reference: String(form.get("reference") ?? ""), paidAt }));
}

/** Super Admin: money received from a professional with no invoice to pay (creates it, paid). */
export async function recordDirectPaymentAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canVerifyPayment(user)) return { status: "error", code: "forbidden" };
  const day = String(form.get("paidOn") ?? "");
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00+01:00`) : null;
  const amount = Number(String(form.get("amount") ?? "").replace(/[\s .]/g, ""));
  return run(() => recordDirectPayment(user, String(form.get("providerId") ?? ""), { amount, method: method(form.get("method")), reference: String(form.get("reference") ?? ""), paidAt }));
}

/** Admin: when one professional's free trial ends (a date, a few more months, or no trial). */
export async function setTrialAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  const mode = String(form.get("mode") ?? "date");
  const day = String(form.get("endsOn") ?? "");
  let endsAt: Date;
  if (mode === "none") endsAt = new Date();
  else if (mode === "plus") {
    const months = Math.min(24, Math.max(1, Number(form.get("months")) || 1));
    const from = new Date(String(form.get("current") ?? ""));
    const base = Number.isNaN(from.getTime()) || from < new Date() ? new Date() : from;
    endsAt = addMonths(base, months);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(day)) endsAt = new Date(`${day}T00:00:00+01:00`);
  else return { status: "error", code: "date" };
  return run(() => setTrialEnd(user, String(form.get("providerId") ?? ""), endsAt));
}

/** Admin: default free-trial length for newly approved professionals (0 = none). */
export async function setTrialDefaultAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  const days = Number(String(form.get("days") ?? "").trim());
  const state = await run(() => setTrialDefault(user, days));
  if (state.status === "done") updateTag("pricing");
  return state;
}

/** Admin: run the cycle now. The confirmation is written here, in the admin's language. */
export async function runCycleAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canReview(user)) return { status: "error", code: "forbidden" };
  if (!rateLimit(`billing-cycle:${user.id}`, 6, 60_000).ok) return { status: "error", code: "generic" };
  let r = { invoices: 0, changed: 0 };
  const state = await run(async () => {
    r = await runBillingCycle();
  });
  if (state.status !== "done") return state;
  const locale = String(form.get("locale") ?? "");
  const d = await getDashboardDictionary(isLocale(locale) ? locale : "fr");
  return { ...state, info: d.billing.cycleDone(r.invoices, r.changed) };
}

/** Super Admin: send a professional an invoice now (she pays, then declares with a proof). */
export async function sendInvoiceAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canVerifyPayment(user)) return { status: "error", code: "forbidden" };
  const amount = Number(String(form.get("amount") ?? "").replace(/[\s .]/g, ""));
  return run(() => sendInvoice(user, String(form.get("providerId") ?? ""), { amount }));
}

/** Admin: stop one professional's free time now (paid months only from here). */
export async function stopTrialAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canReview(user)) return { status: "error", code: "forbidden" };
  return run(() => stopTrial(user, String(form.get("providerId") ?? "")));
}

/** Admin: a new subscription for a professional whose subscription was deleted. */
export async function startSubscriptionAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canReview(user)) return { status: "error", code: "forbidden" };
  return run(() => startSubscription(user, String(form.get("providerId") ?? "")));
}

/** Super Admin: free time for everyone, on or off. The result is written in the admin's language. */
export async function setFreeTrialForAllAction(_prev: BillingState, form: FormData): Promise<BillingState> {
  const user = await getSessionUser();
  if (!user || !canVerifyPayment(user)) return { status: "error", code: "forbidden" };
  const on = form.get("on") === "1";
  let r = { hidden: 0, total: 0 };
  const state = await run(async () => {
    r = await setFreeTrialForAll(user, on);
  });
  if (state.status !== "done") return state;
  const locale = String(form.get("locale") ?? "");
  const d = await getDashboardDictionary(isLocale(locale) ? locale : "fr");
  return { ...state, info: on ? d.billing.freeTrialAll.resumed : d.billing.freeTrialAll.stopped(r.hidden, r.total) };
}
