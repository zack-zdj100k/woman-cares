"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Ymd = { y: number; m: number; d: number };

const parse = (v: string | undefined | null): Ymd | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3] ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};
const iso = ({ y, m, d }: Ymd) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const cmp = (a: Ymd, b: Ymd) => a.y - b.y || a.m - b.m || a.d - b.d;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonth = (y: number, m: number, n: number) => {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};

/**
 * A date field in the site's own style: a large card with big days instead of the browser's small
 * calendar. Submits `YYYY-MM-DD` in a hidden input named `name`, so forms and server actions read it
 * as they read a native date input. `min` and `max` are `YYYY-MM-DD`; days outside them cannot be chosen.
 */
export function DatePicker({
  name,
  defaultValue,
  min,
  max,
  required,
  label,
  className,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  /** Accessible name of the calendar window (the field's own label comes from the <label> around it). */
  label?: string;
  className?: string;
}) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR";
  const weekStart = params.locale === "ar" ? 0 : 1; // Sunday in Algeria, Monday for French
  const minD = parse(min);
  const maxD = parse(max);
  const initial = parse(defaultValue);

  const [value, setValue] = useState<Ymd | null>(initial);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ y: number; m: number }>(() => ({ y: (initial ?? parse(max) ?? { y: new Date().getFullYear() }).y, m: (initial ?? parse(max) ?? { m: new Date().getMonth() + 1 }).m }));
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const text = useMemo(() => {
    if (!value) return "";
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(value.y, value.m - 1, value.d)));
  }, [value, locale]);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(view.y, view.m - 1, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + ((weekStart + i) % 7)))));

  const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const blanks = (first - weekStart + 7) % 7;
  const total = daysIn(view.y, view.m);
  const disabled = (d: Ymd) => Boolean((minD && cmp(d, minD) < 0) || (maxD && cmp(d, maxD) > 0));
  const now = new Date();
  const today: Ymd = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const canPrev = !minD || cmp({ ...addMonth(view.y, view.m, -1), d: daysIn(addMonth(view.y, view.m, -1).y, addMonth(view.y, view.m, -1).m) }, minD) >= 0;
  const canNext = !maxD || cmp({ ...addMonth(view.y, view.m, 1), d: 1 }, maxD) <= 0;

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (d: Ymd) => {
    setValue(d);
    close();
  };
  const go = (n: number) => setView((v) => addMonth(v.y, v.m, n));

  return (
    <>
      <input type="hidden" name={name} value={value ? iso(value) : ""} required={required} />
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          if (value) setView({ y: value.y, m: value.m });
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className={cn("flex h-11 w-full min-w-[12rem] items-center justify-between gap-3 rounded-xl border border-input bg-transparent px-3.5 text-start text-sm transition-colors hover:bg-white/5 focus-visible:border-ring focus-visible:outline-none", className)}
      >
        <span className={value ? "" : "text-muted-foreground"}>{text || "—"}</span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[min(23rem,calc(100vw-1.5rem))] rounded-3xl border border-border bg-card p-0 text-card-foreground shadow-[0_30px_80px_-24px_rgb(0_0_0/0.8)] backdrop:bg-black/60 backdrop:backdrop-blur-sm motion-safe:open:animate-[dialog-in_200ms_ease-out]"
      >
        <div className="grid gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => go(-1)} disabled={!canPrev} aria-label="‹" className="grid size-11 place-items-center rounded-full border border-border hover:bg-white/8 disabled:opacity-30">
              <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <p id={titleId} aria-live="polite" className="text-base font-semibold capitalize">
              {label ? <span className="sr-only">{label} · </span> : null}
              {monthName}
            </p>
            <button type="button" onClick={() => go(1)} disabled={!canNext} aria-label="›" className="grid size-11 place-items-center rounded-full border border-border hover:bg-white/8 disabled:opacity-30">
              <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center" role="grid">
            {weekdays.map((w) => (
              <span key={w} className="py-1 text-xs font-medium capitalize text-muted-foreground">
                {w}
              </span>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: total }, (_, i) => {
              const d: Ymd = { y: view.y, m: view.m, d: i + 1 };
              const chosen = value && cmp(d, value) === 0;
              const isToday = cmp(d, today) === 0;
              const off = disabled(d);
              return (
                <button
                  key={d.d}
                  type="button"
                  disabled={off}
                  onClick={() => pick(d)}
                  aria-pressed={Boolean(chosen)}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "grid aspect-square min-h-11 place-items-center rounded-full text-[0.95rem] tabular-nums transition-colors",
                    chosen ? "bg-foreground font-semibold text-background" : "hover:bg-white/10",
                    !chosen && isToday && "border border-foreground/50",
                    off && "cursor-not-allowed opacity-25 hover:bg-transparent",
                  )}
                >
                  {d.d}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              disabled={disabled(today)}
              onClick={() => pick(today)}
              className="h-10 rounded-full px-4 text-sm font-medium hover:bg-white/8 disabled:opacity-30"
            >
              {params.locale === "ar" ? "اليوم" : "Aujourd’hui"}
            </button>
            <button type="button" onClick={close} className="h-10 rounded-full border border-border px-4 text-sm hover:bg-white/8">
              {params.locale === "ar" ? "إغلاق" : "Fermer"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
