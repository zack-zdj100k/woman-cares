"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { ProviderDictionary } from "@/i18n/dictionaries/provider.fr";
import { addClosureAction, removeClosureAction, saveScheduleAction, type EditorState } from "@/app/[locale]/dashboard/provider/actions";
import { buttonClass } from "@/components/ui/button";
import { Field, TextInput } from "@/components/auth/fields";
import { cn } from "@/lib/cn";
import { SaveStatus } from "./save-status";

type Copy = ProviderDictionary["editor"]["hours"];
type Common = ProviderDictionary["common"];
type Range = { start: string; end: string; capacity: number };
export type WindowRow = { weekday: number; startMinute: number; endMinute: number; capacity: number };

const ORDER = [6, 0, 1, 2, 3, 4, 5]; // the Algerian week starts on Saturday
/** 24-hour quarter-hour choices, identical in every browser locale (native time inputs show AM/PM in some). */
const TIMES = Array.from({ length: 97 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const minutes = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};

export function ScheduleEditor({
  profileId,
  windows,
  weekdays,
  copy,
  common,
  disabled,
}: {
  profileId: string;
  windows: WindowRow[];
  weekdays: string[];
  copy: Copy;
  common: Common;
  disabled: boolean;
}) {
  const [days, setDays] = useState<Record<number, Range[]>>(() => {
    const out: Record<number, Range[]> = {};
    for (const d of ORDER) out[d] = windows.filter((w) => w.weekday === d).map((w) => ({ start: hhmm(w.startMinute), end: hhmm(w.endMinute), capacity: w.capacity }));
    return out;
  });
  const [state, action, pending] = useActionState<EditorState, FormData>(saveScheduleAction, { status: "idle" });
  const confirmRef = useRef<HTMLInputElement>(null);

  const payload = JSON.stringify(
    ORDER.flatMap((d) => days[d].map((r) => ({ weekday: d, startMinute: minutes(r.start), endMinute: minutes(r.end === "00:00" ? "24:00" : r.end), capacity: r.capacity }))),
  );
  const update = (d: number, i: number, patch: Partial<Range>) => setDays((all) => ({ ...all, [d]: all[d].map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const lastEnd = (d: number) => (days[d].length ? days[d][days[d].length - 1].end : "09:00");
  const addRange = (d: number) =>
    setDays((all) => {
      const start = all[d].length ? lastEnd(d) : "09:00";
      const end = all[d].length ? hhmm(Math.min(1440 - 15, minutes(start) + 180)) : "18:00";
      return { ...all, [d]: [...all[d], { start, end, capacity: all[d][0]?.capacity ?? 1 }] };
    });

  const conflicts = state.status === "error" && state.conflicts ? state.conflicts : null;
  const timeInput = "h-11 w-[6.5rem] rounded-(--radius-field) border border-ink/15 bg-ground px-3 text-[0.95rem] focus:border-rose focus:outline-none";

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="windows" value={payload} />
      <input ref={confirmRef} type="hidden" name="confirm" defaultValue="0" />
      <p className="text-ink-2">{copy.intro}</p>
      <fieldset disabled={disabled || pending} className="grid gap-3 disabled:opacity-70">
        {ORDER.map((d) => (
          <div key={d} className="grid gap-3 rounded-(--radius-field) border border-line p-4 sm:grid-cols-[9rem_1fr] sm:items-start">
            <label className="flex items-center gap-3 pt-2.5 font-medium">
              <input
                type="checkbox"
                checked={days[d].length > 0}
                onChange={(e) => setDays((all) => ({ ...all, [d]: e.target.checked ? [{ start: "09:00", end: "18:00", capacity: 1 }] : [] }))}
                className="size-4 accent-[var(--rose)]"
              />
              {weekdays[d]}
            </label>
            {days[d].length === 0 ? (
              <p className="pt-2.5 text-ink-2">{copy.closed}</p>
            ) : (
              <div className="grid gap-3">
                {days[d].map((r, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-xs text-ink-2">
                      {copy.from}
                      <select value={r.start} onChange={(e) => update(d, i, { start: e.target.value })} className={timeInput} dir="ltr">
                        {TIMES.slice(0, -1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs text-ink-2">
                      {copy.to}
                      <select value={r.end === "00:00" ? "24:00" : r.end} onChange={(e) => update(d, i, { end: e.target.value })} className={timeInput} dir="ltr">
                        {TIMES.slice(1).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs text-ink-2" title={copy.capacityHint}>
                      {copy.capacity}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={r.capacity}
                        onChange={(e) => update(d, i, { capacity: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                        className={cn(timeInput, "w-20")}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setDays((all) => ({ ...all, [d]: all[d].filter((_, j) => j !== i) }))}
                      aria-label={copy.remove}
                      className="mb-1 grid size-9 place-items-center rounded-full border border-ink/15 hover:bg-surface"
                    >
                      <X className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                ))}
                {days[d].length < 4 && (
                  <button type="button" onClick={() => addRange(d)} className="inline-flex items-center gap-1.5 justify-self-start text-sm text-rose-ink underline-offset-4 hover:underline">
                    <Plus className="size-3.5" strokeWidth={2} />
                    {copy.addRange}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </fieldset>
      <p className="text-sm text-ink-2">{copy.capacityHint}</p>
      {state.status === "error" && (state.message === "overlap" || state.message === "invalid") && (
        <p role="alert" className="text-sm text-rose-ink">
          {copy.errors[state.message]}
        </p>
      )}
      {conflicts && (
        <div role="alert" className="grid gap-3 rounded-(--radius-field) bg-surface p-4 text-sm">
          <p>{copy.conflicts.replace("{refs}", conflicts.join(", "))}</p>
          <button
            type="submit"
            onClick={() => confirmRef.current && (confirmRef.current.value = "1")}
            className={buttonClass({ variant: "outline", size: "sm", className: "justify-self-start" })}
          >
            {copy.confirm}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={disabled || pending}
          onClick={() => confirmRef.current && (confirmRef.current.value = "0")}
          className={buttonClass({ variant: "solid" })}
        >
          {pending ? common.saving : copy.save}
        </button>
        {!(state.status === "error" && (state.message === "overlap" || state.message === "invalid" || state.conflicts)) && (
          <SaveStatus state={state} saved={common.saved} errors={common.errors} />
        )}
      </div>
    </form>
  );
}

export function Closures({
  profileId,
  closures,
  copy,
  common,
  disabled,
}: {
  profileId: string;
  closures: { id: string; label: string; note: string | null }[];
  copy: Copy;
  common: Common;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState<EditorState, FormData>(addClosureAction, { status: "idle" });
  const e = state.status === "error" ? state.errors ?? {} : {};
  return (
    <div className="grid gap-5">
      <h3 className="type-display text-2xl">{copy.closuresTitle}</h3>
      {closures.length === 0 ? (
        <p className="text-ink-2">{copy.noClosures}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {closures.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-2 rounded-full border border-line py-1.5 ps-4 pe-1.5 text-sm">
              {c.label}
              {c.note && <span className="text-ink-2">· {c.note}</span>}
              <form action={removeClosureAction}>
                <input type="hidden" name="exceptionId" value={c.id} />
                <button type="submit" disabled={disabled} aria-label={copy.removeClosure} className="grid size-7 place-items-center rounded-full hover:bg-surface">
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <form key={state.status === "saved" ? state.at : "form"} action={action} className="grid gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end" noValidate>
          <input type="hidden" name="profileId" value={profileId} />
          <Field label={copy.closureFrom} error={e.from ? copy.closureErrors.from : undefined}>
            {({ id, invalid }) => <TextInput id={id} name="from" type="date" required invalid={invalid} />}
          </Field>
          <Field label={copy.closureTo} error={e.to ? copy.closureErrors.to : undefined}>
            {({ id, invalid }) => <TextInput id={id} name="to" type="date" required invalid={invalid} />}
          </Field>
          <Field label={copy.closureNote}>{({ id }) => <TextInput id={id} name="note" maxLength={200} />}</Field>
          <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", className: "mb-0.5" })}>
            {copy.addClosure}
          </button>
          <div className="sm:col-span-4">
            <SaveStatus state={state} saved={common.saved} errors={common.errors} />
          </div>
        </form>
      )}
    </div>
  );
}
