"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { wilayas } from "@/config/wilayas";
import type { Locale } from "@/i18n/config";
import type { AuthDictionary } from "@/i18n/dictionaries/auth.fr";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "@/app/[locale]/auth/actions";
import { Field, FormAlert, PasswordInput, TextInput, fieldClass } from "./fields";

type Common = AuthDictionary["common"];
const idle: FormState = { status: "idle" };

function values(state: FormState) {
  return state.status === "error" ? state.values : {};
}
function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}
function messageText(message: string | undefined, common: Common, extra: Record<string, string> = {}) {
  if (!message) return null;
  return extra[message] ?? (message === "rate" ? common.rate : common.generic);
}

export function SignInForm({
  locale,
  nextSlot,
  copy,
  common,
}: {
  locale: Locale;
  /** Streamed hidden "next" input; the form itself stays static so typing is never interrupted. */
  nextSlot?: ReactNode;
  copy: Omit<AuthDictionary["signIn"], "notices">;
  common: Common;
}) {
  const [state, action, pending] = useActionState(signInAction, idle);
  const v = values(state);
  const msg = state.status === "error" ? messageText(state.message, common, copy.errors) : null;
  return (
    <form key={state.status === "error" ? JSON.stringify(v) : "initial"} action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {nextSlot}
      {msg && <FormAlert>{msg}</FormAlert>}
      <Field label={common.email}>
        {({ id }) => <TextInput id={id} name="email" type="email" autoComplete="email" required defaultValue={str(v.email)} />}
      </Field>
      <Field label={common.password}>
        {({ id }) => (
          <PasswordInput id={id} name="password" autoComplete="current-password" required showLabel={common.showPassword} hideLabel={common.hidePassword} />
        )}
      </Field>
      <Link href={`/${locale}/auth/forgot-password`} className="justify-self-start text-sm text-rose-ink underline-offset-4 hover:underline">
        {copy.forgot}
      </Link>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "lg", className: "w-full" })}>
        {pending ? copy.pending : copy.submit}
      </button>
    </form>
  );
}

export function SignUpForm({
  locale,
  role,
  copy,
  common,
  categoryNames,
  workplaceLabels,
}: {
  locale: Locale;
  role: "client" | "provider";
  copy: AuthDictionary["signUp"];
  common: Common;
  categoryNames: Record<CategorySlug, string>;
  workplaceLabels: Record<"SALON" | "STUDIO" | "HOME" | "MOBILE", string>;
}) {
  const [state, action, pending] = useActionState(signUpAction, idle);
  const v = values(state);
  const e = state.status === "error" ? state.errors : {};
  const err = (key: string) => (e[key] ? (copy.errors as Record<string, string>)[key === "password" ? e[key] : key] ?? common.generic : undefined);
  const msg = state.status === "error" ? messageText(state.message, common) : null;
  const provider = role === "provider";
  const chosen = new Set(Array.isArray(v.categories) ? v.categories : []);

  return (
    <form key={JSON.stringify(v)} action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="role" value={role} />
      {msg && <FormAlert>{msg}</FormAlert>}

      <Field label={copy.fullName} error={err("fullName")}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} name="fullName" autoComplete="name" required maxLength={120} defaultValue={str(v.fullName)} aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
      {provider && (
        <Field label={copy.businessName} error={err("businessName")}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} name="businessName" autoComplete="organization" required maxLength={120} defaultValue={str(v.businessName)} aria-describedby={describedBy} invalid={invalid} />
          )}
        </Field>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={common.email} error={err("email")}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} name="email" type="email" autoComplete="email" required maxLength={200} defaultValue={str(v.email)} aria-describedby={describedBy} invalid={invalid} />
          )}
        </Field>
        <Field label={copy.phone} error={err("phone")} hint={copy.phoneHint}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={20} defaultValue={str(v.phone)} aria-describedby={describedBy} invalid={invalid} dir="ltr" />
          )}
        </Field>
      </div>
      <Field label={common.password} error={err("password")} hint={copy.passwordHint}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} name="password" autoComplete="new-password" required minLength={10} aria-describedby={describedBy} invalid={invalid} showLabel={common.showPassword} hideLabel={common.hidePassword} />
        )}
      </Field>

      {provider ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={copy.wilaya} error={err("wilaya")}>
              {({ id, describedBy, invalid }) => (
                <select id={id} name="wilaya" required defaultValue={str(v.wilaya)} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(fieldClass, invalid ? "border-rose" : "border-ink/15")}>
                  <option value="" disabled>
                    {copy.chooseWilaya}
                  </option>
                  {wilayas.map((w) => (
                    <option key={w.code} value={w.code}>
                      {String(w.code).padStart(2, "0")} {locale === "ar" ? w.ar : w.fr}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={copy.commune}>
              {({ id }) => <TextInput id={id} name="commune" maxLength={80} defaultValue={str(v.commune)} autoComplete="address-level2" />}
            </Field>
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">{copy.workplace}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(workplaceLabels) as (keyof typeof workplaceLabels)[]).map((w) => (
                <label key={w} className="flex cursor-pointer items-center gap-3 rounded-(--radius-field) border border-ink/15 p-3.5 text-sm has-[:checked]:border-rose has-[:checked]:bg-surface">
                  <input type="radio" name="workplaceType" value={w} defaultChecked={str(v.workplaceType) === w} className="size-4 accent-[var(--rose)]" />
                  {workplaceLabels[w]}
                </label>
              ))}
            </div>
            {e.workplaceType && <p className="text-sm text-rose-ink">{copy.errors.workplaceType}</p>}
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">{copy.categories}</legend>
            <p className="text-sm text-ink-2">{copy.categoriesHint}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categorySlugs.map((slug) => (
                <label key={slug} className="flex cursor-pointer items-center gap-3 rounded-(--radius-field) border border-ink/15 p-3.5 text-sm has-[:checked]:border-rose has-[:checked]:bg-surface">
                  <input type="checkbox" name="categories" value={slug} defaultChecked={chosen.has(slug)} className="size-4 accent-[var(--rose)]" />
                  {categoryNames[slug]}
                </label>
              ))}
            </div>
            {e.categories && <p className="text-sm text-rose-ink">{copy.errors.categories}</p>}
          </fieldset>
        </>
      ) : (
        <Field label={copy.preferredWilaya}>
          {({ id }) => (
            <select id={id} name="preferredWilaya" defaultValue={str(v.preferredWilaya)} className={cn(fieldClass, "border-ink/15")}>
              <option value="">-</option>
              {wilayas.map((w) => (
                <option key={w.code} value={w.code}>
                  {String(w.code).padStart(2, "0")} {locale === "ar" ? w.ar : w.fr}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <div className="grid gap-2">
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input type="checkbox" name="terms" defaultChecked={str(v.terms) === "on"} className="mt-1 size-4 shrink-0 accent-[var(--rose)]" aria-invalid={Boolean(e.terms) || undefined} />
          <span>
            {copy.terms}{" "}
            <Link href={`/${locale}/legal/terms`} target="_blank" className="underline underline-offset-4">
              {copy.termsLink}
            </Link>{" "}
            {copy.and}{" "}
            <Link href={`/${locale}/legal/privacy`} target="_blank" className="underline underline-offset-4">
              {copy.privacyLink}
            </Link>
            .
          </span>
        </label>
        {e.terms && <p className="text-sm text-rose-ink">{copy.errors.terms}</p>}
      </div>

      <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "lg", className: "w-full" })}>
        {pending ? copy.pending : provider ? copy.submitProvider : copy.submitClient}
      </button>
    </form>
  );
}

export function ForgotPasswordForm({ locale, copy, common }: { locale: Locale; copy: AuthDictionary["forgot"]; common: Common }) {
  const [state, action, pending] = useActionState(forgotPasswordAction, idle);
  if (state.status === "done") {
    return (
      <div role="status" className="flex gap-3 rounded-(--radius-media) bg-parchment p-6">
        <CircleCheck className="size-5 shrink-0 text-rose" strokeWidth={1.75} />
        <p className="leading-relaxed">{copy.sent}</p>
      </div>
    );
  }
  const v = values(state);
  const msg = state.status === "error" ? messageText(state.message, common) : null;
  return (
    <form key={JSON.stringify(v)} action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {msg && <FormAlert>{msg}</FormAlert>}
      <Field label={common.email}>
        {({ id }) => <TextInput id={id} name="email" type="email" autoComplete="email" required defaultValue={str(v.email)} />}
      </Field>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "lg", className: "w-full" })}>
        {pending ? copy.pending : copy.submit}
      </button>
    </form>
  );
}

export function ResetPasswordForm({
  locale,
  token,
  copy,
  common,
  passwordCopy,
}: {
  locale: Locale;
  token: string;
  copy: AuthDictionary["reset"];
  common: Common;
  passwordCopy: { hint: string; length: string; weak: string };
}) {
  const [state, action, pending] = useActionState(resetPasswordAction, idle);
  const e = state.status === "error" ? state.errors : {};
  const msg =
    state.status === "error" && state.message
      ? state.message === "expired"
        ? copy.expired
        : state.message === "invalid"
          ? copy.invalid
          : messageText(state.message, common)
      : null;
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      {msg && (
        <FormAlert>
          {msg}{" "}
          {(state.status === "error" && (state.message === "expired" || state.message === "invalid")) && (
            <Link href={`/${locale}/auth/forgot-password`} className="underline underline-offset-4">
              {copy.requestNew}
            </Link>
          )}
        </FormAlert>
      )}
      <Field label={common.password} hint={passwordCopy.hint} error={e.password ? (e.password === "weak" ? passwordCopy.weak : passwordCopy.length) : undefined}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} name="password" autoComplete="new-password" required minLength={10} aria-describedby={describedBy} invalid={invalid} showLabel={common.showPassword} hideLabel={common.hidePassword} />
        )}
      </Field>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "lg", className: "w-full" })}>
        {pending ? copy.pending : copy.submit}
      </button>
    </form>
  );
}

export function ResendVerificationForm({ locale, copy, common }: { locale: Locale; copy: AuthDictionary["account"]; common: Common }) {
  const [state, action, pending] = useActionState(resendVerificationAction, idle);
  if (state.status === "done") return <p className="text-sm">{copy.resent}</p>;
  return (
    <form action={action} className="inline">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" disabled={pending} className="text-sm font-medium underline underline-offset-4 hover:text-rose-ink">
        {copy.resend}
      </button>
      {state.status === "error" && <span className="ms-3 text-sm text-rose-ink">{messageText(state.message, common)}</span>}
    </form>
  );
}
