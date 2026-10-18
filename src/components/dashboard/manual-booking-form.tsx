"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { manualBookingAction, type ManualState } from "@/app/[locale]/dashboard/booking-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUARTERS } from "./booking-forms";

type Service = { id: string; name: string; duration: number };
type Labels = {
  service: string;
  serviceHint: string;
  day: string;
  time: string;
  duration: string;
  guestName: string;
  guestPhone: string;
  price: string;
  note: string;
  save: string;
  cancel: string;
  errors: Record<string, string>;
};

const field = "grid gap-1.5 text-sm";
const select = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none [&>option]:bg-popover";

/**
 * Adds an appointment by hand from the calendar: any service of hers, any day and hour (even outside
 * her hours or past midnight), the client's full name and phone, an optional agreed price.
 */
export function ManualBookingForm({
  locale,
  profileId,
  services,
  defaults,
  closeHref,
  labels,
}: {
  locale: string;
  /** The category profile the appointment belongs to (the calendar's selected category). */
  profileId: string;
  /** Her services in that category, offered as suggestions; any other text is accepted. */
  services: Service[];
  defaults: { day: string; time: string };
  closeHref: string;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState<ManualState, FormData>(manualBookingAction, { status: "idle" });
  const [duration, setDuration] = useState(String(services[0]?.duration ?? 60));
  const pick = (text: string) => {
    const s = services.find((x) => x.name.toLowerCase() === text.trim().toLowerCase());
    if (s) setDuration(String(s.duration));
  };

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="profileId" value={profileId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${field} sm:col-span-2`}>
          {labels.service}
          <Input name="serviceName" list="my-services" required minLength={2} maxLength={120} defaultValue={services[0]?.name ?? ""} onChange={(e) => pick(e.target.value)} autoComplete="off" />
          <datalist id="my-services">
            {services.map((x) => (
              <option key={x.id} value={x.name} />
            ))}
          </datalist>
          <span className="text-xs text-muted-foreground">{labels.serviceHint}</span>
        </label>
        <label className={field}>
          {labels.day}
          <Input type="date" name="day" defaultValue={defaults.day} required dir="ltr" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            {labels.time}
            <select name="time" defaultValue={defaults.time} className={select} dir="ltr">
              {QUARTERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            {labels.duration}
            <Input name="duration" type="number" min={10} max={720} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className="tabular-nums" />
          </label>
        </div>
        <label className={`${field} sm:col-span-2`}>
          {labels.guestName}
          <Input name="guestName" required minLength={2} maxLength={120} autoComplete="off" />
        </label>
        <label className={field}>
          {labels.guestPhone}
          <Input name="guestPhone" inputMode="tel" dir="ltr" maxLength={24} autoComplete="off" />
        </label>
        <label className={field}>
          {labels.price}
          <Input name="price" inputMode="decimal" className="tabular-nums" />
        </label>
        <label className={`${field} sm:col-span-2 lg:col-span-4`}>
          {labels.note}
          <Input name="note" maxLength={500} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {labels.save}
        </button>
        <Link href={closeHref} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {labels.cancel}
        </Link>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {labels.errors[state.code] ?? labels.errors.generic}
          </p>
        )}
      </div>
    </form>
  );
}
