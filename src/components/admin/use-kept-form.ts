"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { SettingsFormState } from "@/app/[locale]/dashboard/admin/settings-actions";

/**
 * A form action that keeps what was typed. React 19 empties a form after its action runs, even when
 * the action refused it; for a long number or a name that means typing everything again because of
 * one wrong password. Submitting through a transition leaves the fields as they are.
 */
export function useKeptForm(action: (prev: SettingsFormState, form: FormData) => Promise<SettingsFormState>) {
  const [state, dispatch, pending] = useActionState(action, { status: "idle" } as SettingsFormState);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}
