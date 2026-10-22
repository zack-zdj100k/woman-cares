"use client";

import { savePublisherAction } from "@/app/[locale]/dashboard/admin/settings-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKeptForm } from "./use-kept-form";

type Fields = { name: string; rc: string; nif: string; address: string; phone: string; email: string };
type Labels = Record<keyof Fields, string> & { save: string; saved: string; errors: Record<string, string> };

/** Who publishes the site: shown at the foot of the legal pages. */
export function PublisherForm({ values, labels }: { values: Fields; labels: Labels }) {
  const { state, pending, onSubmit } = useKeptForm(savePublisherAction);
  const field = (name: keyof Fields, extra?: { dir?: "ltr"; type?: string }) => (
    <label key={name} className="grid gap-1.5 text-sm">
      <span className="font-medium">{labels[name]}</span>
      <Input name={name} defaultValue={values[name]} type={extra?.type} dir={extra?.dir} maxLength={200} autoComplete="off" />
    </label>
  );
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {field("name")}
        {field("email", { dir: "ltr", type: "email" })}
        {field("rc", { dir: "ltr" })}
        {field("nif", { dir: "ltr" })}
        {field("phone", { dir: "ltr" })}
        {field("address")}
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
