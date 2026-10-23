"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  recordDirectPaymentAction,
  sendInvoiceAction,
  setFreeTrialForAllAction,
  startSubscriptionAction,
  stopTrialAction,
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
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
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

/** Phone photos are often larger than the upload limit: shrink them to a readable JPEG first. */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size <= 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Professional: declare a transfer for an invoice, with a proof (receipt photo, screenshot or PDF). */
export function DeclarePaymentForm({
  invoiceId,
  labels,
}: {
  invoiceId: string;
  labels: { declare: string; help: string; method: string; reference: string; message: string; proof: string; proofHelp: string; send: string; done: string; methods: Record<string, string>; errors: Errors };
}) {
  const [key] = useState(newKey);
  const [state, setState] = useState<BillingState>({ status: "idle" });
  const [pending, setPending] = useState(false);
  const router = useRouter();
  if (state.status === "done") return <p role="status" className="text-sm text-success">{labels.done}</p>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    form.delete("file");
    if (file instanceof File && file.size > 0) form.set("file", await shrinkPhoto(file), file.name);
    try {
      const res = await fetch(`/api/v1/billing/invoices/${invoiceId}/declare`, { method: "POST", body: form });
      if (res.ok) {
        setState({ status: "done", at: Date.now() });
        router.refresh();
      } else {
        const code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code?.toLowerCase() ?? "generic";
        setState({ status: "error", code });
      }
    } catch {
      setState({ status: "error", code: "generic" });
    }
    setPending(false);
  }

  return (
    <details className="group rounded-xl border border-border p-4" open>
      <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">{labels.declare}</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <p className="text-xs text-muted-foreground">{labels.help}</p>
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
          {labels.proof}
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm file:me-3 file:rounded-full file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm" />
          <span className="text-xs text-muted-foreground">{labels.proofHelp}</span>
        </label>
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
type TrialLabels = { endsOn: string; save: string; plus: { months: number; label: string }[]; done: string; errors: Errors };

/** Admin: when this professional's free trial ends. Any date, or quick extensions (stopping it is StopTrialButton). */
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

/** Super Admin: send a professional an invoice now. */
export function SendInvoiceForm({ providerId, amount, labels }: { providerId: string; amount: number | null; labels: { title: string; help: string; amount: string; send: string; sent: string; errors: Errors } }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(sendInvoiceAction, { status: "idle" });
  return (
    <form action={action} className="grid content-start gap-3 rounded-xl border border-border p-4">
      <input type="hidden" name="providerId" value={providerId} />
      <div>
        <p className="text-sm font-medium">{labels.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{labels.help}</p>
      </div>
      <label className={field}>
        {labels.amount}
        <Input name="amount" inputMode="numeric" defaultValue={amount ? String(amount) : ""} required className="max-w-[14rem] tabular-nums" dir="ltr" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          {labels.send}
        </button>
        <Feedback state={state} errors={labels.errors} done={labels.sent} />
      </div>
    </form>
  );
}

/** A one-button form that asks before acting (the message says what will happen). */
function ConfirmButton({
  action,
  fields,
  label,
  confirm,
  done,
  tone = "outline",
  errors,
}: {
  action: (prev: BillingState, form: FormData) => Promise<BillingState>;
  fields: Record<string, string>;
  label: string;
  confirm?: string;
  done?: string;
  tone?: "outline" | "solid" | "danger";
  errors: Errors;
}) {
  const [state, run, pending] = useActionState<BillingState, FormData>(action, { status: "idle" });
  return (
    <form action={run} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} className="flex flex-wrap items-center gap-3">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={buttonClass({ variant: tone === "solid" ? "solid" : "outline", size: "sm", className: tone === "danger" ? "text-destructive" : undefined })}
      >
        {label}
      </button>
      {state.status === "done" && (state.info || done) && <p role="status" className="text-sm text-success">{state.info ?? done}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{errors[state.code] ?? errors.generic}</p>}
    </form>
  );
}

export function StopTrialButton({ providerId, labels }: { providerId: string; labels: { stop: string; stopConfirm: string; stopped: string; errors: Errors } }) {
  return <ConfirmButton action={stopTrialAction} fields={{ providerId }} label={labels.stop} confirm={labels.stopConfirm} done={labels.stopped} tone="danger" errors={labels.errors} />;
}

export function StartSubscriptionButton({ providerId, labels }: { providerId: string; labels: { start: string; started: string; errors: Errors } }) {
  return <ConfirmButton action={startSubscriptionAction} fields={{ providerId }} label={labels.start} done={labels.started} tone="solid" errors={labels.errors} />;
}

/** Super Admin (Paramètres): free time for everyone, on or off. */
export function FreeTrialSwitch({ on, locale, labels }: { on: boolean; locale: string; labels: { stop: string; stopConfirm: string; resume: string; errors: Errors } }) {
  return on ? (
    <ConfirmButton action={setFreeTrialForAllAction} fields={{ on: "0", locale }} label={labels.stop} confirm={labels.stopConfirm} tone="danger" errors={labels.errors} />
  ) : (
    <ConfirmButton action={setFreeTrialForAllAction} fields={{ on: "1", locale }} label={labels.resume} tone="solid" errors={labels.errors} />
  );
}
