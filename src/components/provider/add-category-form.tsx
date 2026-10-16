"use client";

import { useActionState } from "react";
import { addCategoryAction, type EditorState } from "@/app/[locale]/dashboard/provider/actions";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/auth/fields";
import { cn } from "@/lib/cn";

export function AddCategoryForm({
  options,
  labels,
  notes,
  errors,
}: {
  options: { slug: string; label: string }[];
  labels: { choose: string; submit: string };
  notes: Record<string, string>;
  errors: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(addCategoryAction, { status: "idle" });
  if (options.length === 0) return null;
  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        <select name="category" required defaultValue="" aria-label={labels.choose} className={cn(fieldClass, "max-w-xs border-ink/15")}>
          <option value="" disabled>
            {labels.choose}
          </option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={buttonClass({ variant: "outline" })}>
          {labels.submit}
        </button>
      </div>
      {state.status === "saved" && state.note && <p role="status" className="text-sm">{notes[state.note]}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-rose-ink">{errors[state.message ?? "generic"] ?? errors.generic}</p>}
    </form>
  );
}
