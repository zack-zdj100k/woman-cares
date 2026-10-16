"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import type { PagesDictionary } from "@/i18n/dictionaries/pages.fr";
import { submitContact, type ContactState } from "@/app/[locale]/contact/actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Copy = PagesDictionary["contact"];

export function ContactForm({ copy }: { copy: Copy }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="flex gap-4 rounded-(--radius-media) bg-parchment p-8">
        <CircleCheck className="size-6 shrink-0 text-rose" strokeWidth={1.75} />
        <p className="text-lg leading-relaxed">{copy.sent}</p>
      </div>
    );
  }

  const invalid = state.status === "error" ? state.fields ?? {} : {};
  const v = state.status === "error" ? state.values : undefined;
  const field =
    "w-full rounded-(--radius-field) border bg-ground px-4 text-[0.95rem] text-ink transition-colors focus:border-rose focus:outline-none";
  const label = "text-sm font-medium";
  const error = "text-sm text-rose-ink";

  return (
    <form key={JSON.stringify(v ?? {})} action={action} noValidate className="grid gap-6">
      {state.status === "error" && state.reason && (
        <p role="alert" className="rounded-(--radius-field) bg-surface p-4 text-sm text-rose-ink">
          {copy.errors[state.reason]}
        </p>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="c-name" className={label}>
            {copy.name}
          </label>
          <input id="c-name" name="name" defaultValue={v?.name} autoComplete="name" required maxLength={120} aria-invalid={invalid.name} aria-describedby={invalid.name ? "c-name-err" : undefined} className={cn(field, "h-12", invalid.name ? "border-rose" : "border-ink/15")} />
          {invalid.name && <p id="c-name-err" className={error}>{copy.errors.name}</p>}
        </div>
        <div className="grid gap-2">
          <label htmlFor="c-email" className={label}>
            {copy.email}
          </label>
          <input id="c-email" name="email" defaultValue={v?.email} type="email" autoComplete="email" required maxLength={200} aria-invalid={invalid.email} aria-describedby={invalid.email ? "c-email-err" : undefined} className={cn(field, "h-12", invalid.email ? "border-rose" : "border-ink/15")} />
          {invalid.email && <p id="c-email-err" className={error}>{copy.errors.email}</p>}
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="c-type" className={label}>
          {copy.type}
        </label>
        <select id="c-type" name="type" defaultValue={v?.type || "GENERAL"} className={cn(field, "h-12 border-ink/15")}>
          {Object.entries(copy.types).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label htmlFor="c-subject" className={label}>
          {copy.subject}
        </label>
        <input id="c-subject" name="subject" defaultValue={v?.subject} required maxLength={160} aria-invalid={invalid.subject} aria-describedby={invalid.subject ? "c-subject-err" : undefined} className={cn(field, "h-12", invalid.subject ? "border-rose" : "border-ink/15")} />
        {invalid.subject && <p id="c-subject-err" className={error}>{copy.errors.subject}</p>}
      </div>
      <div className="grid gap-2">
        <label htmlFor="c-message" className={label}>
          {copy.message}
        </label>
        <textarea id="c-message" name="message" defaultValue={v?.message} required rows={7} maxLength={5000} aria-invalid={invalid.message} aria-describedby={invalid.message ? "c-message-err" : undefined} className={cn(field, "py-3", invalid.message ? "border-rose" : "border-ink/15")} />
        {invalid.message && <p id="c-message-err" className={error}>{copy.errors.message}</p>}
      </div>
      {/* Honeypot, hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <p className="text-sm text-ink-2">{copy.privacy}</p>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "lg", className: "justify-self-start" })}>
        {pending ? copy.sending : copy.send}
      </button>
    </form>
  );
}
