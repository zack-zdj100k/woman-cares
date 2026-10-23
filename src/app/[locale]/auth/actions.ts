"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { rateLimit } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/auth/redirects";
import { endSession, getSessionUser, requestMeta, startSession } from "@/lib/auth/session";
import { clientSignUpSchema, emailOnlySchema, fieldErrors, providerSignUpSchema, resetSchema, signInSchema } from "@/lib/validation/auth";
import { homeArea } from "@/server/policies/roles";
import { db } from "@/lib/db";
import {
  authenticate,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signUpClient,
  signUpProvider,
  claimFirstSignIn,
  verifyEmail,
} from "@/server/services/auth";
import { deliverPendingEmails } from "@/server/services/outbox";

export type FormState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; errors: Record<string, string>; message?: string; values: Record<string, string | string[]> };

const MIN = 60_000;

function localeOf(form: FormData): Locale {
  const l = String(form.get("locale") ?? "");
  return isLocale(l) ? l : "fr";
}

/** Everything except passwords, so a failed submit can refill the form. */
function echo(form: FormData) {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(form.keys())) {
    if (key === "password" || key.startsWith("$")) continue;
    const all = form.getAll(key).map(String);
    values[key] = key === "categories" ? all : (all[0] ?? "").slice(0, 300);
  }
  return values;
}

/** Sends queued emails after the response, so a slow or failing mail server never blocks the request. */
function flushEmails() {
  after(() => deliverPendingEmails().catch((e) => console.error("[outbox]", e)));
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = echo(form);
  const { ip } = await requestMeta();
  if (!rateLimit(`signup:${ip}`, 10, 60 * MIN).ok) return { status: "error", errors: {}, message: "rate", values };

  const role = form.get("role") === "provider" ? "provider" : "client";
  const raw = { ...Object.fromEntries(form), categories: form.getAll("categories") };
  if (role === "provider") {
    const parsed = providerSignUpSchema.safeParse(raw);
    if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values };
    await signUpProvider(parsed.data, locale);
  } else {
    const parsed = clientSignUpSchema.safeParse(raw);
    if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values };
    await signUpClient(parsed.data, locale);
  }
  // Same destination whether the email was new or already registered (no account enumeration).
  flushEmails();
  redirect(`/${locale}/auth/check-email`);
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = echo(form);
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", errors: {}, message: "invalid", values };

  const { ip } = await requestMeta();
  if (!rateLimit(`signin:ip:${ip}`, 30, 15 * MIN).ok || !rateLimit(`signin:email:${parsed.data.email}`, 10, 15 * MIN).ok) {
    return { status: "error", errors: {}, message: "rate", values };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) return { status: "error", errors: {}, message: result.reason, values };

  await startSession(result.userId);
  const user = await db.user.findUniqueOrThrow({ where: { id: result.userId }, select: { role: true } });
  const next = safeNextPath(form.get("next"), locale);
  redirect(next ?? `/${locale}/dashboard/${homeArea(user.role)}`);
}

export async function signOutAction(form: FormData) {
  const locale = localeOf(form);
  await endSession();
  // "Switch account" from a page (e.g. booking as a client) comes back to that page after signing in.
  const next = safeNextPath(form.get("next"), locale);
  redirect(`/${locale}/auth/sign-in?notice=signedOut${next ? `&next=${encodeURIComponent(next)}` : ""}`);
}

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = echo(form);
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", errors: { email: "email" }, values };
  const { ip } = await requestMeta();
  if (!rateLimit(`forgot:${ip}`, 10, 60 * MIN).ok || !rateLimit(`forgot:${parsed.data.email}`, 3, 60 * MIN).ok) {
    return { status: "error", errors: {}, message: "rate", values };
  }
  await requestPasswordReset(parsed.data.email, locale);
  flushEmails();
  return { status: "done" };
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = echo(form);
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", errors: {}, message: "invalid", values };
  const { ip } = await requestMeta();
  if (!rateLimit(`reset:${ip}`, 20, 60 * MIN).ok) return { status: "error", errors: {}, message: "rate", values };

  const result = await resetPassword(parsed.data.token, parsed.data.password, locale);
  if (!result.ok) {
    const fieldProblem = result.reason === "length" || result.reason === "weak";
    return { status: "error", errors: fieldProblem ? { password: result.reason } : {}, message: fieldProblem ? undefined : result.reason, values };
  }
  flushEmails();
  redirect(`/${locale}/auth/sign-in?notice=reset`);
}

/**
 * POST-only confirmation, so link scanners in mail clients cannot consume the token (the page submits
 * it itself for a real browser). A first confirmation signs her in and opens her space; otherwise she
 * lands on the confirmation page and signs in with her password.
 */
export async function verifyEmailAction(form: FormData) {
  const locale = localeOf(form);
  const token = String(form.get("token") ?? "");
  const result = token.length >= 20 && token.length <= 100 ? await verifyEmail(token) : { ok: false as const, reason: "invalid" as const };
  if (result.ok) {
    flushEmails();
    const role = await claimFirstSignIn(result.userId);
    if (role) {
      await startSession(result.userId);
      redirect(`/${locale}/dashboard/${homeArea(role)}`);
    }
  }
  redirect(`/${locale}/auth/verify-email?status=${result.ok ? "ok" : result.reason}`);
}

export async function resendVerificationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const user = await getSessionUser();
  if (!user) return { status: "error", errors: {}, message: "generic", values: {} };
  if (!rateLimit(`resend:${user.id}`, 3, 60 * MIN).ok) return { status: "error", errors: {}, message: "rate", values: {} };
  await resendVerification(user.id, locale);
  flushEmails();
  return { status: "done" };
}
