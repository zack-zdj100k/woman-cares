"use client";

import { useActionState } from "react";
import type { ProviderDictionary } from "@/i18n/dictionaries/provider.fr";
import { saveDetailsAction, type EditorState } from "@/app/[locale]/dashboard/provider/actions";
import { Field, TextInput, fieldClass } from "@/components/auth/fields";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SaveStatus } from "./save-status";

type Initial = {
  headline: string;
  description: string;
  experienceYears: number | null;
  specialties: string[];
  hygieneNotes: string;
  productNotes: string;
  cancellationPolicy: string;
  instagram: string;
  facebook: string;
  tiktok: string;
};

export function DetailsForm({
  profileId,
  initial,
  specialtyOptions,
  copy,
  common,
  disabled,
}: {
  profileId: string;
  initial: Initial;
  specialtyOptions: { slug: string; label: string }[];
  copy: ProviderDictionary["editor"]["details"];
  common: ProviderDictionary["common"];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveDetailsAction, { status: "idle" });
  const e = state.status === "error" ? state.errors ?? {} : {};
  const v = (state.status === "error" && state.values ? state.values : initial) as Record<string, unknown>;
  const text = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : v[k] == null ? "" : String(v[k]));
  const chosen = new Set((Array.isArray(v.specialties) ? v.specialties : initial.specialties) as string[]);
  const err = (k: keyof typeof copy.errors) => (e[k] ? copy.errors[k] : undefined);
  const area = cn(fieldClass, "h-auto min-h-28 py-3 leading-relaxed border-ink/15");

  return (
    <form key={state.status === "error" ? state.at : "form"} action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="profileId" value={profileId} />
      <fieldset disabled={disabled || pending} className="grid gap-6 disabled:opacity-70">
        <Field label={copy.headline} hint={copy.headlineHint} error={err("headline")}>
          {({ id, describedBy, invalid }) => <TextInput id={id} name="headline" maxLength={120} defaultValue={text("headline")} aria-describedby={describedBy} invalid={invalid} />}
        </Field>
        <Field label={copy.description} hint={copy.descriptionHint} error={err("description")}>
          {({ id, describedBy, invalid }) => (
            <textarea id={id} name="description" rows={7} maxLength={3000} defaultValue={text("description")} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cn(area, invalid && "border-rose")} />
          )}
        </Field>
        <Field label={copy.experienceYears} error={err("experienceYears")}>
          {({ id }) => <TextInput id={id} name="experienceYears" type="number" min={0} max={60} inputMode="numeric" defaultValue={text("experienceYears")} className="max-w-40" />}
        </Field>
        {specialtyOptions.length > 0 && (
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">{copy.specialties}</legend>
            <div className="flex flex-wrap gap-2">
              {specialtyOptions.map((s) => (
                <label key={s.slug} className="flex cursor-pointer items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm has-[:checked]:border-rose has-[:checked]:bg-surface">
                  <input type="checkbox" name="specialties" value={s.slug} defaultChecked={chosen.has(s.slug)} className="size-4 accent-[var(--rose)]" />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Field label={copy.hygieneNotes} hint={copy.hygieneHint}>
          {({ id, describedBy }) => <textarea id={id} name="hygieneNotes" rows={3} maxLength={1500} defaultValue={text("hygieneNotes")} aria-describedby={describedBy} className={area} />}
        </Field>
        <Field label={copy.productNotes}>
          {({ id }) => <textarea id={id} name="productNotes" rows={3} maxLength={1500} defaultValue={text("productNotes")} className={area} />}
        </Field>
        <Field label={copy.cancellationPolicy}>
          {({ id }) => <textarea id={id} name="cancellationPolicy" rows={3} maxLength={1500} defaultValue={text("cancellationPolicy")} className={area} />}
        </Field>
        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm font-medium">{copy.social}</legend>
          {(["instagram", "facebook", "tiktok"] as const).map((k) => (
            <Field key={k} label={<span className="capitalize text-ink-2">{k}</span>} error={err(k)}>
              {({ id, invalid }) => <TextInput id={id} name={k} type="url" dir="ltr" placeholder={`https://www.${k}.com/…`} defaultValue={text(k)} invalid={invalid} />}
            </Field>
          ))}
        </fieldset>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={disabled || pending} className={buttonClass({ variant: "solid" })}>
          {pending ? common.saving : common.save}
        </button>
        <SaveStatus state={state} saved={common.saved} errors={common.errors} />
      </div>
    </form>
  );
}
