"use client";

import { useActionState, useState } from "react";
import {
  declarePaymentAction,
  recordDirectPaymentAction,
  recordPaymentAction,
  runCycleAction,
  setTermsAction,
  setTrialAction,
  setTrialDefaultAction,
  verifyPaymentAction,
  type BillingState,
} from "@/app/[locale]/dashboard/billing-actions";
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
export function RecordPaymentForm({
  invoiceId,
  today,
  labels,
}: {
  invoiceId: string;
  /** Algiers date (YYYY-MM-DD): the default and the latest day a payment can be dated. */
  today: string;
  labels: { method: string; reference: string; paidOn: string; save: string; methods: Record<string, string>; errors: Errors };
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(recordPaymentAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
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
        {labels.paidOn}
        <Input name="paidOn" type="date" defaultValue={today} max={today} min="2020-01-01" required dir="ltr" className="w-[10.5rem]" />
      </label>
      <label className={field}>
        {labels.reference}
        <Input name="reference" required minLength={3} maxLength={120} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
        {labels.save}
      </button>
      <div className="sm:col-span-4">
        <Feedback state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

/** Super Admin: money received from a professional who has no invoice to pay. */
export function DirectPaymentForm({
  providerId,
  amount,
  today,
  labels,
}: {
  providerId: string;
  /** Suggested amount: her agreed or standard monthly price (editable). */
  amount: number | null;
  today: string;
  labels: { title: string; help: string; amount: string; method: string; reference: string; paidOn: string; save: string; done: string; methods: Record<string, string>; errors: Errors };
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(recordDirectPaymentAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-chart-1/40 bg-chart-1/5 p-4">
      <input type="hidden" name="providerId" value={providerId} />
      <div>
        <p className="text-sm font-medium">{labels.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{labels.help}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className={field}>
          {labels.amount}
          <Input name="amount" inputMode="numeric" defaultValue={amount ? String(amount) : ""} required className="tabular-nums" dir="ltr" />
        </label>
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
          {labels.paidOn}
          <Input name="paidOn" type="date" defaultValue={today} max={today} min="2020-01-01" required dir="ltr" />
        </label>
        <label className={field}>
          {labels.reference}
          <Input name="reference" required minLength={3} maxLength={120} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.save}
        </button>
        <Feedback state={state} errors={labels.errors} done={labels.done} />
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

/** `plus` holds ready-made button texts (functions cannot cross into client components). */
type TrialLabels = { endsOn: string; save: string; plus: { months: number; label: string }[]; none: string; noneHint: string; done: string; errors: Errors };

/** Admin: when this professional's free trial ends. Any date; quick extensions; or no trial at all. */
export function TrialForm({ providerId, endsOn, current, labels }: { providerId: string; endsOn: string; current: string | null; labels: TrialLabels }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(setTrialAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="current" value={current ?? ""} />
      <div className="flex flex-wrap items-end gap-2">
        <label className={field}>
          {labels.endsOn}
          <Input name="endsOn" type="date" defaultValue={endsOn} min="2020-01-01" dir="ltr" className="w-[11rem]" />
        </label>
        <button type="submit" name="mode" value="date" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.save}
        </button>
        {labels.plus.map(({ months, label }) => (
          <button key={months} type="submit" name="mode" value="plus" onClick={(e) => e.currentTarget.form?.querySelector<HTMLInputElement>("input[name=months]")?.setAttribute("value", String(months))} disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
            {label}
          </button>
        ))}
        <input type="hidden" name="months" defaultValue="1" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" name="mode" value="none" disabled={pending} className={buttonClass({ variant: "ghost", size: "sm", className: "text-destructive" })}>
          {labels.none}
        </button>
        <span className="text-xs text-muted-foreground">{labels.noneHint}</span>
      </div>
      <Feedback state={state} errors={labels.errors} done={labels.done} />
    </form>
  );
}

/** Admin: default trial length for professionals approved from now on. */
export function TrialDefaultForm({ days, labels }: { days: number; labels: { title: string; help: string; days: string; save: string; done: string; errors: Errors } }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(setTrialDefaultAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-2">
      <p className="text-sm font-medium">{labels.title}</p>
      <p className="text-xs text-muted-foreground">{labels.help}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className={field}>
          {labels.days}
          <Input name="days" type="number" min={0} max={730} step={1} defaultValue={days} required className="w-28 tabular-nums" />
        </label>
        <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          {labels.save}
        </button>
      </div>
      <Feedback state={state} errors={labels.errors} done={labels.done} />
    </form>
  );
}
