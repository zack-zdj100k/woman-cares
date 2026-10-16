"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import type { ProviderDictionary } from "@/i18n/dictionaries/provider.fr";
import { deleteServiceAction, saveServiceAction, type EditorState } from "@/app/[locale]/dashboard/provider/actions";
import { Field, TextInput, fieldClass } from "@/components/auth/fields";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SaveStatus } from "./save-status";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceMin: string;
  priceMax: string | null;
  active: boolean;
};

type Copy = ProviderDictionary["editor"]["services"];
type Common = ProviderDictionary["common"];

function ServiceForm({
  profileId,
  service,
  copy,
  common,
  disabled,
}: {
  profileId: string;
  service?: ServiceRow;
  copy: Copy;
  common: Common;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveServiceAction, { status: "idle" });
  const e = state.status === "error" ? state.errors ?? {} : {};
  const v = (state.status === "error" && state.values) || {
    name: service?.name ?? "",
    description: service?.description ?? "",
    durationMinutes: service?.durationMinutes ?? 60,
    bufferMinutes: service?.bufferMinutes ?? 0,
    priceMin: service?.priceMin ? String(Math.round(Number(service.priceMin))) : "",
    priceMax: service?.priceMax ? String(Math.round(Number(service.priceMax))) : "",
    active: service ? (service.active ? "on" : "") : "on",
  };
  const s = (k: string) => (v[k as keyof typeof v] == null ? "" : String(v[k as keyof typeof v]));
  const err = (k: keyof Copy["errors"]) => (e[k] ? copy.errors[k] : undefined);

  return (
    <form key={state.status === "idle" ? "form" : state.at} action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="profileId" value={profileId} />
      {service && <input type="hidden" name="serviceId" value={service.id} />}
      <fieldset disabled={disabled || pending} className="grid gap-5 disabled:opacity-70">
        <Field label={copy.name} error={err("name")}>
          {({ id, invalid }) => <TextInput id={id} name="name" maxLength={120} defaultValue={s("name")} invalid={invalid} />}
        </Field>
        <Field label={copy.description} error={err("description")}>
          {({ id }) => <textarea id={id} name="description" rows={2} maxLength={600} defaultValue={s("description")} className={cn(fieldClass, "h-auto border-ink/15 py-3")} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={copy.duration} error={err("durationMinutes")}>
            {({ id, invalid }) => <TextInput id={id} name="durationMinutes" type="number" min={10} max={600} step={5} inputMode="numeric" defaultValue={s("durationMinutes")} invalid={invalid} />}
          </Field>
          <Field label={copy.buffer} error={err("bufferMinutes")}>
            {({ id, invalid }) => <TextInput id={id} name="bufferMinutes" type="number" min={0} max={120} step={5} inputMode="numeric" defaultValue={s("bufferMinutes")} invalid={invalid} />}
          </Field>
          <Field label={copy.priceMin} error={err("priceMin")}>
            {({ id, invalid }) => <TextInput id={id} name="priceMin" type="number" min={0} step={50} inputMode="numeric" defaultValue={s("priceMin")} invalid={invalid} />}
          </Field>
          <Field label={copy.priceMax} error={err("priceMax")}>
            {({ id, invalid }) => <TextInput id={id} name="priceMax" type="number" min={0} step={50} inputMode="numeric" defaultValue={s("priceMax")} invalid={invalid} />}
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={s("active") === "on"} className="size-4 accent-[var(--rose)]" />
          {copy.active}
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={disabled || pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {pending ? common.saving : service ? common.save : copy.add}
        </button>
        <SaveStatus state={state} saved={common.saved} errors={common.errors} />
      </div>
    </form>
  );
}

function DeleteService({ serviceId, copy, common, disabled }: { serviceId: string; copy: Copy; common: Common; disabled: boolean }) {
  const [state, action, pending] = useActionState<EditorState, FormData>(deleteServiceAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="serviceId" value={serviceId} />
      <button type="submit" disabled={disabled || pending} className="text-sm text-rose-ink underline underline-offset-4 disabled:opacity-50">
        {copy.delete}
      </button>
      <SaveStatus state={state} saved={common.saved} errors={common.errors} notes={{ deactivated: copy.deactivated }} />
    </form>
  );
}

export function ServicesEditor({
  profileId,
  services,
  copy,
  common,
  disabled,
  formatPrice,
}: {
  profileId: string;
  services: ServiceRow[];
  copy: Copy;
  common: Common;
  disabled: boolean;
  /** Pre-formatted price labels keyed by service id (formatted on the server, in the page locale). */
  formatPrice: Record<string, string>;
}) {
  return (
    <div className="grid gap-6">
      <p className="text-ink-2">{copy.intro}</p>
      {services.length === 0 ? (
        <p className="rounded-(--radius-field) bg-surface p-5 text-ink-2">{copy.empty}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {services.map((s) => (
            <li key={s.id}>
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-medium">{s.name}</span>
                    {!s.active && <span className="ms-2 rounded-full bg-surface px-2.5 py-0.5 text-xs">{copy.inactive}</span>}
                    <span className="block text-sm text-ink-2">
                      {s.durationMinutes} {copy.minutes}
                    </span>
                  </span>
                  <span className="text-end text-sm">{formatPrice[s.id]}</span>
                </summary>
                <div className="mt-5 grid gap-4 rounded-(--radius-field) bg-surface p-5">
                  <ServiceForm profileId={profileId} service={s} copy={copy} common={common} disabled={disabled} />
                  <DeleteService serviceId={s.id} copy={copy} common={common} disabled={disabled} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <details className="rounded-(--radius-field) border border-dashed border-ink/25 p-5" open={services.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
            <Plus className="size-4" strokeWidth={1.75} />
            {copy.newTitle}
          </summary>
          <div className="mt-5">
            <ServiceForm profileId={profileId} copy={copy} common={common} disabled={disabled} />
          </div>
        </details>
      )}
    </div>
  );
}
