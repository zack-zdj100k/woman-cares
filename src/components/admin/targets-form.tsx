"use client";

import { useActionState } from "react";
import { setTargetsAction, type TargetsState } from "@/app/[locale]/dashboard/admin/settings-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { key: string; label: string; hint: string; value: string; higher: boolean };

/** Reference rates for the professionals' statistics, in percent. */
export function TargetsForm({ rows, labels }: { rows: Row[]; labels: { min: string; max: string; save: string; saved: string; errors: Record<string, string> } }) {
  const [state, action, pending] = useActionState<TargetsState, FormData>(setTargetsAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <label key={r.key} className="grid gap-1.5 rounded-xl border border-border p-4 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="text-xs text-muted-foreground">{r.hint}</span>
            <span className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{r.higher ? labels.min : labels.max}</span>
              <Input name={r.key} defaultValue={r.value} inputMode="decimal" className="w-24 tabular-nums" />
              <span className="text-muted-foreground">%</span>
            </span>
          </label>
        ))}
      </div>
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
