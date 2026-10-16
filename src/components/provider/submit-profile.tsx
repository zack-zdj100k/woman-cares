"use client";

import { useActionState } from "react";
import { submitProfileAction, type EditorState } from "@/app/[locale]/dashboard/provider/actions";
import { buttonClass } from "@/components/ui/button";

export function SubmitProfile({
  profileId,
  labels,
  checklistLabels,
  errors,
}: {
  profileId: string;
  labels: { submit: string; submitting: string; submitted: string; incomplete: string };
  checklistLabels: Record<string, string>;
  errors: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(submitProfileAction, { status: "idle" });
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="profileId" value={profileId} />
      <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", className: "justify-self-start" })}>
        {pending ? labels.submitting : labels.submit}
      </button>
      {state.status === "saved" && <p role="status" className="text-sm">{labels.submitted}</p>}
      {state.status === "error" && state.missing && (
        <p role="alert" className="text-sm text-rose-ink">
          {labels.incomplete} {state.missing.map((m) => checklistLabels[m]).join(", ")}.
        </p>
      )}
      {state.status === "error" && !state.missing && state.message && (
        <p role="alert" className="text-sm text-rose-ink">
          {errors[state.message] ?? errors.generic}
        </p>
      )}
    </form>
  );
}
