"use client";

import { useActionState } from "react";
import { reviewAction, type ReviewState } from "@/app/[locale]/dashboard/admin/actions";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/auth/fields";
import { cn } from "@/lib/cn";
import { useAnnounce } from "@/components/ui/decision-feedback";

type Labels = { note: string; notePlaceholder: string; done: string; errors: Record<string, string> };

/**
 * One review decision. Decisions that change what the provider can do (refusals, suspensions,
 * change requests) ask for a message, which is sent to her and kept in the audit log.
 */
export function DecisionForm({
  op,
  id,
  label,
  labels,
  tone = "outline",
  withNote = false,
  optionalNote = false,
}: {
  op: string;
  id: string;
  label: string;
  labels: Labels;
  tone?: "solid" | "outline" | "danger";
  withNote?: boolean;
  optionalNote?: boolean;
}) {
  const announce = useAnnounce();
  // Announced from the action itself: the refresh that follows may unmount this form in the same commit.
  const [state, action, pending] = useActionState<ReviewState, FormData>(async (prev, form) => {
    const next = await reviewAction(prev, form);
    announce(next.status === "done" ? labels.done : "");
    return next;
  }, { status: "idle" });
  const button = buttonClass({
    variant: tone === "solid" ? "solid" : "outline",
    size: "sm",
    className: tone === "danger" ? "border-rose/40 text-rose-ink hover:bg-rose/10" : undefined,
  });
  // Success is announced once for the whole page (see DecisionFeedback); errors stay next to the button.
  const feedback =
    state.status === "error" ? (
      <p role="alert" className="text-sm text-rose-ink">
        {labels.errors[state.message] ?? labels.errors.generic}
      </p>
    ) : null;

  if (!withNote) {
    return (
      <form action={action} className="grid gap-2">
        <input type="hidden" name="op" value={op} />
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={pending} className={cn(button, "justify-self-start")}>
          {label}
        </button>
        {feedback}
      </form>
    );
  }
  return (
    <details className="group" open={state.status === "error"}>
      <summary className={cn(button, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>{label}</summary>
      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="op" value={op} />
        <input type="hidden" name="id" value={id} />
        <label className="grid gap-2 text-sm font-medium">
          {labels.note}
          <textarea
            name="note"
            rows={3}
            maxLength={1000}
            required={!optionalNote}
            placeholder={labels.notePlaceholder}
            className={cn(fieldClass, "h-auto border-ink/15 py-3 font-normal")}
          />
        </label>
        <button type="submit" disabled={pending} className={cn(buttonClass({ variant: "solid", size: "sm" }), "justify-self-start")}>
          {label}
        </button>
        {feedback}
      </form>
    </details>
  );
}
