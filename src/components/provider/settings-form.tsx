"use client";

import { useActionState, useState } from "react";
import { LocateFixed, LoaderCircle } from "lucide-react";
import { wilayas } from "@/config/wilayas";
import type { Locale } from "@/i18n/config";
import type { ProviderDictionary } from "@/i18n/dictionaries/provider.fr";
import { saveSettingsAction, type EditorState } from "@/app/[locale]/dashboard/provider/actions";
import { Field, TextInput, fieldClass } from "@/components/auth/fields";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SaveStatus } from "./save-status";

type Initial = {
  businessName: string;
  bio: string;
  publicPhone: string;
  wilaya: number;
  commune: string;
  addressLine: string;
  workplaceType: "SALON" | "STUDIO" | "HOME" | "MOBILE";
  locationVisibility: "EXACT" | "APPROXIMATE" | "COMMUNE_ONLY";
  latitude: number | null;
  longitude: number | null;
};

export function SettingsForm({
  locale,
  initial,
  copy,
  common,
  workplaceLabels,
  disabled,
}: {
  locale: Locale;
  initial: Initial;
  copy: ProviderDictionary["settings"];
  common: ProviderDictionary["common"];
  workplaceLabels: Record<Initial["workplaceType"], string>;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveSettingsAction, { status: "idle" });
  const e = state.status === "error" ? state.errors ?? {} : {};
  const v = (state.status === "error" && state.values ? state.values : initial) as Record<string, unknown>;
  const s = (k: string) => (v[k] == null ? "" : String(v[k]));
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial.latitude != null && initial.longitude != null ? { lat: initial.latitude, lng: initial.longitude } : null,
  );
  const [geo, setGeo] = useState<"idle" | "locating" | "denied">("idle");
  const err = (k: keyof typeof copy.errors) => (e[k] ? copy.errors[k] : undefined);

  const locate = () => {
    if (!("geolocation" in navigator)) return setGeo("denied");
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 });
        setGeo("idle");
      },
      () => setGeo("denied"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <form key={state.status === "error" ? state.at : "form"} action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      <fieldset disabled={disabled || pending} className="grid gap-6 disabled:opacity-70">
        <Field label={copy.businessName} error={err("businessName")}>
          {({ id, invalid }) => <TextInput id={id} name="businessName" maxLength={120} defaultValue={s("businessName")} invalid={invalid} />}
        </Field>
        <Field label={copy.bio} error={err("bio")}>
          {({ id }) => <textarea id={id} name="bio" rows={4} maxLength={1500} defaultValue={s("bio")} className={cn(fieldClass, "h-auto border-ink/15 py-3 leading-relaxed")} />}
        </Field>
        <Field label={copy.publicPhone} hint={copy.publicPhoneHint} error={err("publicPhone")}>
          {({ id, describedBy, invalid }) => <TextInput id={id} name="publicPhone" type="tel" dir="ltr" maxLength={20} defaultValue={s("publicPhone")} aria-describedby={describedBy} invalid={invalid} />}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={copy.wilaya} error={err("wilaya")}>
            {({ id }) => (
              <select id={id} name="wilaya" defaultValue={s("wilaya")} className={cn(fieldClass, "border-ink/15")}>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {String(w.code).padStart(2, "0")} {locale === "ar" ? w.ar : w.fr}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={copy.commune} hint={copy.communeHint}>
            {({ id, describedBy }) => <TextInput id={id} name="commune" maxLength={80} defaultValue={s("commune")} aria-describedby={describedBy} />}
          </Field>
        </div>
        <Field label={copy.addressLine} hint={copy.addressHint} error={err("addressLine")}>
          {({ id, describedBy }) => <TextInput id={id} name="addressLine" maxLength={200} autoComplete="street-address" defaultValue={s("addressLine")} aria-describedby={describedBy} />}
        </Field>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">{copy.workplace}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(workplaceLabels) as Initial["workplaceType"][]).map((w) => (
              <label key={w} className="flex cursor-pointer items-center gap-3 rounded-(--radius-field) border border-ink/15 p-3.5 text-sm has-[:checked]:border-rose has-[:checked]:bg-surface">
                <input type="radio" name="workplaceType" value={w} defaultChecked={s("workplaceType") === w} className="size-4 accent-[var(--rose)]" />
                {workplaceLabels[w]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">{copy.visibility}</legend>
          {(["EXACT", "APPROXIMATE", "COMMUNE_ONLY"] as const).map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-3 rounded-(--radius-field) border border-ink/15 p-3.5 text-sm has-[:checked]:border-rose has-[:checked]:bg-surface">
              <input type="radio" name="locationVisibility" value={o} defaultChecked={s("locationVisibility") === o} className="size-4 accent-[var(--rose)]" />
              {copy.visibilityOptions[o]}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{copy.location}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={locate} className={buttonClass({ variant: coords ? "solid" : "outline", size: "sm" })}>
              {geo === "locating" ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} /> : <LocateFixed className="size-4" strokeWidth={1.75} />}
              {geo === "locating" ? copy.locating : copy.locate}
            </button>
            {coords && (
              <button type="button" onClick={() => setCoords(null)} className="text-sm underline underline-offset-4">
                {copy.clearLocation}
              </button>
            )}
          </div>
          <p className="text-sm text-ink-2" aria-live="polite">
            {geo === "denied" ? copy.geoDenied : coords ? copy.located : copy.noLocation}
          </p>
        </div>
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
