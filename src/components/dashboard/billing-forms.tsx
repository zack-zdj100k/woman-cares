"use client";

import { useActionState, useState } from "react";
import { declarePaymentAction, recordPaymentAction, runCycleAction, setTermsAction, verifyPaymentAction, type BillingState } from "@/app/[locale]/dashboard/billing-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnnounce } from "@/components/ui/decision-feedback";
import { cn } from "@/lib/utils";

type Errors = Record<string, string>;
const field = "grid gap-1.5 text-sm";
const select = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none [&>option]:bg-popover";

function Feedback({ state, errors, done }: { state: BillingState; errors: Errors; done?: string }) {
  if (state.status === "error") return <p role="alert" className="text-sm text-destructive">{errors[state.code] ?? errors.generic}</p>;
  if (state.status === "done" && done) return <p role="status" className="text-sm text-success">{done}</p>;
  return null;
}

/** Admin: how one professional is billed (request: "change her payment price"). */
export function TermsForm({
  providerId,
  current,
  negotiated,
  reason,
  labels,
}: {
  providerId: string;
  current: "PER_CATEGORY" | "NEGOTIATED" | "EXEMPT";
  negotiated: string | null;
  reason: string | null;
  labels: { standard: string; standardHelp: string; negotiated: string; negotiatedHelp: string; exemption: string; exemptionHelp: string; monthly: string; reason: string; save: string; saved: string; errors: Errors };
}) {
  const [basis, setBasis] = useState(current);
  const [state, action, pending] = useActionState<BillingState, FormData>(setTermsAction, { status: "idle" });
  const options = [
    { value: "PER_CATEGORY" as const, label: labels.standard, help: labels.standardHelp },
    { value: "NEGOTIATED" as const, label: labels.negotiated, help: labels.negotiatedHelp },
    { value: "EXEMPT" as const, label: labels.exemption, help: labels.exemptionHelp },
  ];
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="providerId" value={providerId} />
      <fieldset className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label key={o.value} className={cn("cursor-pointer rounded-xl border p-3.5 transition-colors", basis === o.value ? "border-chart-1 bg-chart-1/10" : "border-border hover:bg-white/4")}>
            <span className="flex items-center gap-2 text-sm font-medium">
              <input type="radio" name="basis" value={o.value} checked={basis === o.value} onChange={() => setBasis(o.value)} className="accent-[var(--chart-1)]" />
              {o.label}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{o.help}</span>
          </label>
        ))}
      </fieldset>
      {basis === "NEGOTIATED" && (
        <label className={field}>
          {labels.monthly}
          <Input name="amount" inputMode="numeric" defaultValue={negotiated ? String(Math.round(Number(negotiated))) : ""} required className="max-w-[14rem] tabular-nums" />
        </label>
      )}
      {basis !== "PER_CATEGORY" && (
        <label className={field}>
          {labels.reason}
          <Input name="reason" defaultValue={reason ?? ""} required minLength={5} maxLength={300} />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.save}
        </button>
        <Feedback state={state} errors={labels.errors} done={labels.saved} />
      </div>
    </form>
  );
}

const METHODS = ["MANUAL_TRANSFER", "CCP", "BARIDIMOB", "CASH"] as const;

/** Admin: record a payment seen directly. */
export function RecordPaymentForm({ invoiceId, labels }: { invoiceId: string; labels: { method: string; reference: string; save: string; methods: Record<string, string>; errors: Errors } }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(recordPaymentAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label className={field}>
        {labels.method}
        <select name="method" className={select}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {labels.methods[m]}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {labels.reference}
        <Input name="reference" required minLength={3} maxLength={120} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
        {labels.save}
      </button>
      <div className="sm:col-span-3">
        <Feedback state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

/** Admin: confirm or refuse a declared transfer. Announced page-wide (the row leaves the queue). */
export function VerifyPaymentForm({ paymentId, labels }: { paymentId: string; labels: { verify: string; refuse: string; reason: string; done: string; errors: Errors } }) {
  const announce = useAnnounce();
  const [refusing, setRefusing] = useState(false);
  const [state, action, pending] = useActionState<BillingState, FormData>(async (prev, form) => {
    const next = await verifyPaymentAction(prev, form);
    announce(next.status === "done" ? labels.done : "");
    return next;
  }, { status: "idle" });
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      {refusing && (
        <label className={field}>
          {labels.reason}
          <Input name="note" required minLength={5} maxLength={500} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {!refusing && (
          <button type="submit" name="decision" value="verify" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
            {labels.verify}
          </button>
        )}
        {refusing ? (
          <button type="submit" name="decision" value="refuse" disabled={pending} className={buttonClass({ variant: "outline", size: "sm", className: "text-destructive" })}>
            {labels.refuse}
          </button>
        ) : (
          <button type="button" onClick={() => setRefusing(true)} className={buttonClass({ variant: "outline", size: "sm" })}>
            {labels.refuse}
          </button>
        )}
      </div>
      <Feedback state={state} errors={labels.errors} />
    </form>
  );
}

export function RunCycleButton({ locale, labels }: { locale: string; labels: { run: string; errors: Errors } }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(runCycleAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
        {labels.run}
      </button>
      {state.status === "done" && state.info && <p role="status" className="text-sm text-success">{state.info}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{labels.errors[state.code] ?? labels.errors.generic}</p>}
    </form>
  );
}

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

/** Professional: declare a transfer for an invoice. */
export function DeclarePaymentForm({
  invoiceId,
  labels,
}: {
  invoiceId: string;
  labels: { declare: string; help: string; method: string; reference: string; message: string; send: string; done: string; methods: Record<string, string>; errors: Errors };
}) {
  const [key] = useState(newKey);
  const [state, action, pending] = useActionState<BillingState, FormData>(declarePaymentAction, { status: "idle" });
  if (state.status === "done") return <p role="status" className="text-sm text-success">{labels.done}</p>;
  return (
    <details className="group rounded-xl border border-border p-4">
      <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">{labels.declare}</summary>
      <form action={action} className="mt-4 grid gap-3">
        <p className="text-xs text-muted-foreground">{labels.help}</p>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="key" value={key} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>
            {labels.method}
            <select name="method" className={select}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {labels.methods[m]}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            {labels.reference}
            <Input name="reference" required minLength={3} maxLength={120} />
          </label>
        </div>
        <label className={field}>
          {labels.message}
          <Input name="note" maxLength={500} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
            {labels.send}
          </button>
          <Feedback state={state} errors={labels.errors} />
        </div>
      </form>
    </details>
  );
}
