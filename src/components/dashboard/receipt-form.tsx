"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";

type Labels = { title: string; hint: string; file: string; note: string; from: string; to: string; save: string; saved: string; errors: Record<string, string> };

/** Admin: attach a receipt (file and/or note, period paid) to a verified payment. */
export function ReceiptForm({ paymentId, note, from, to, labels }: { paymentId: string; note: string; from: string; to: string; labels: Labels }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    const res = await fetch(`/api/v1/billing/payments/${paymentId}/receipt`, { method: "POST", body: new FormData(e.currentTarget) });
    if (!res.ok) {
      const code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code ?? "GENERIC";
      setState(code);
      return;
    }
    setState("done");
    router.refresh();
  }

  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">{labels.title}</summary>
      <form ref={formRef} onSubmit={submit} className="mt-3 grid gap-3">
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
        <label className="grid gap-1.5 text-sm">
          {labels.file}
          <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm file:me-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-foreground" />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm">
            {labels.from}
            <DatePicker name="from" defaultValue={from} label={labels.from} />
          </label>
          <label className="grid gap-1.5 text-sm">
            {labels.to}
            <DatePicker name="to" defaultValue={to} label={labels.to} />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm">
          {labels.note}
          <Input name="note" defaultValue={note} maxLength={1000} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={state === "busy"} className={buttonClass({ variant: "solid", size: "sm" })}>
            {labels.save}
          </button>
          {state === "done" && <p role="status" className="text-sm text-success">{labels.saved}</p>}
          {state !== "idle" && state !== "busy" && state !== "done" && (
            <p role="alert" className="text-sm text-destructive">
              {labels.errors[state] ?? labels.errors.GENERIC}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
