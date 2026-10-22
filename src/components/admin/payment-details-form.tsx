"use client";

import { useEffect, useRef } from "react";
import { savePaymentDetailsAction } from "@/app/[locale]/dashboard/admin/settings-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKeptForm } from "./use-kept-form";

type Labels = {
  holder: string;
  rip: string;
  ripHint: string;
  password: string;
  passwordHint: string;
  save: string;
  saved: string;
  errors: Record<string, string>;
};

/** Where professionals send their subscription payment. Asks for the password on every save. */
export function PaymentDetailsForm({ holder, rip, labels }: { holder: string; rip: string; labels: Labels }) {
  const { state, pending, onSubmit } = useKeptForm(savePaymentDetailsAction);
  const password = useRef<HTMLInputElement>(null);
  // Whatever the outcome, the password is never left sitting in the field.
  useEffect(() => {
    if (password.current && state.status !== "idle") password.current.value = "";
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" autoComplete="off">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{labels.holder}</span>
          <Input name="holder" defaultValue={holder} required minLength={2} maxLength={80} autoComplete="off" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{labels.rip}</span>
          <Input name="rip" defaultValue={rip} required inputMode="numeric" dir="ltr" className="tabular-nums" autoComplete="off" />
          <span className="text-xs text-muted-foreground">{labels.ripHint}</span>
        </label>
      </div>
      <label className="grid max-w-sm gap-1.5 text-sm">
        <span className="font-medium">{labels.password}</span>
        <Input ref={password} name="password" type="password" required autoComplete="current-password" />
        <span className="text-xs text-muted-foreground">{labels.passwordHint}</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.save}
        </button>
        {state.status === "done" && <p role="status" className="text-sm text-success">{labels.saved}</p>}
        {state.status === "error" && <p role="alert" className="text-sm text-destructive">{labels.errors[state.code] ?? labels.errors.generic}</p>}
      </div>
    </form>
  );
}
