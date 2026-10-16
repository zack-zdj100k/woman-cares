"use client";

import { useActionState, type ReactNode } from "react";
import { manageAction } from "@/app/[locale]/dashboard/admin/manage-actions";
import type { ReviewState } from "@/app/[locale]/dashboard/admin/actions";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-class";
import { useAnnounce } from "@/components/ui/decision-feedback";
import { cn } from "@/lib/cn";

export type ManageLabels = { done: string; errors: Record<string, string> };

/**
 * One admin change (users, categories, prices), posted to `manageAction`. Changes with a wide effect
 * open a confirmation step first (`confirm`); suspensions ask for a reason (`note`), kept in the audit log.
 * `fields` are extra inputs (a role menu, a price and a date) placed before the button.
 */
export function ManageForm({
  op,
  id,
  label,
  labels,
  tone = "outline",
  note,
  confirm,
  fields,
  ariaLabel,
  children,
  className,
}: {
  op: string;
  id: string;
  label: string;
  labels: ManageLabels;
  tone?: "solid" | "outline" | "danger";
  note?: { label: string; placeholder: string };
  confirm?: string;
  fields?: ReactNode;
  /** For icon-only buttons (reordering). */
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  const announce = useAnnounce();
  const [state, action, pending] = useActionState<ReviewState, FormData>(async (prev, form) => {
    const next = await manageAction(prev, form);
    announce(next.status === "done" ? labels.done : "");
    return next;
  }, { status: "idle" });
  const button = buttonClass({
    variant: tone === "solid" ? "solid" : "outline",
    size: "sm",
    className: tone === "danger" ? "text-rose-ink" : undefined,
  });
  const feedback =
    state.status === "error" ? (
      <p role="alert" className="text-sm text-rose-ink">
        {labels.errors[state.message] ?? labels.errors.generic}
      </p>
    ) : null;
  const hidden = (
    <>
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="id" value={id} />
    </>
  );

  if (!note && !confirm) {
    return (
      <form action={action} className={cn("grid gap-2", className)}>
        {hidden}
        {fields}
        <button type="submit" disabled={pending} aria-label={ariaLabel} className={cn(button, "justify-self-start", children ? "w-10 px-0! [&_svg]:shrink-0" : undefined)}>
          {children ?? label}
        </button>
        {feedback}
      </form>
    );
  }
  return (
    <details className={cn("group", className)} open={state.status === "error"}>
      <summary className={cn(button, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>{label}</summary>
      <form action={action} className="mt-3 grid max-w-md gap-3">
        {hidden}
        {confirm && <p className="text-sm leading-relaxed text-ink-2">{confirm}</p>}
        {note && (
          <label className="grid gap-2 text-sm font-medium">
            {note.label}
            <textarea name="note" rows={3} maxLength={1000} required minLength={10} placeholder={note.placeholder} className={cn(fieldClass, "h-auto border-ink/15 py-3 font-normal")} />
          </label>
        )}
        <button type="submit" disabled={pending} className={cn(buttonClass({ variant: "solid", size: "sm" }), "justify-self-start")}>
          {label}
        </button>
        {feedback}
      </form>
    </details>
  );
}
