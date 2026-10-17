"use client";

import { useActionState } from "react";
import { changePasswordAction, updateAccountAction, type AccountState } from "@/app/[locale]/dashboard/account-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Errors = Record<string, string>;
const field = "grid gap-1.5 text-sm";
const select = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none [&>option]:bg-popover";

function Feedback({ state, errors, done }: { state: AccountState; errors: Errors; done: string }) {
  if (state.status === "error") return <p role="alert" className="text-sm text-destructive">{errors[state.code] ?? errors.generic}</p>;
  if (state.status === "done") return <p role="status" className="text-sm text-success">{done}</p>;
  return null;
}

export function ProfileForm({ values, labels }: { values: { fullName: string; phone: string; locale: string }; labels: { fullName: string; phone: string; language: string; save: string; saved: string; errors: Errors } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateAccountAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <label className={field}>
        {labels.fullName}
        <Input name="fullName" defaultValue={values.fullName} required minLength={2} maxLength={120} autoComplete="name" />
      </label>
      <label className={field}>
        {labels.phone}
        <Input name="phone" defaultValue={values.phone} inputMode="tel" autoComplete="tel" dir="ltr" maxLength={24} />
      </label>
      <label className={field}>
        {labels.language}
        <select name="locale" defaultValue={values.locale} className={select}>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.save}
        </button>
        <Feedback state={state} errors={labels.errors} done={labels.saved} />
      </div>
    </form>
  );
}

export function PasswordForm({ labels }: { labels: { help: string; current: string; next: string; change: string; changed: string; errors: Errors } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePasswordAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <p className="text-sm text-muted-foreground">{labels.help}</p>
      <label className={field}>
        {labels.current}
        <Input name="current" type="password" required autoComplete="current-password" />
      </label>
      <label className={field}>
        {labels.next}
        <Input name="next" type="password" required minLength={10} autoComplete="new-password" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.change}
        </button>
        <Feedback state={state} errors={labels.errors} done={labels.changed} />
      </div>
    </form>
  );
}
