"use client";

import { CircleCheck } from "lucide-react";
import type { EditorState } from "@/app/[locale]/dashboard/provider/actions";

/** Inline result of a save: a short confirmation or the reason it failed. */
export function SaveStatus({
  state,
  saved,
  errors,
  notes = {},
}: {
  state: EditorState;
  saved: string;
  errors: Record<string, string>;
  notes?: Record<string, string>;
}) {
  if (state.status === "saved") {
    return (
      <p role="status" key={state.at} className="inline-flex items-center gap-1.5 text-sm text-ink-2">
        <CircleCheck className="size-4 text-rose" strokeWidth={1.75} />
        {(state.note && notes[state.note]) || saved}
      </p>
    );
  }
  if (state.status === "error" && state.message && !state.conflicts && !state.missing) {
    return (
      <p role="alert" className="text-sm text-rose-ink">
        {errors[state.message] ?? errors.generic}
      </p>
    );
  }
  if (state.status === "error" && state.errors && Object.keys(state.errors).length) {
    return (
      <p role="alert" className="text-sm text-rose-ink">
        {errors.invalid}
      </p>
    );
  }
  return null;
}
