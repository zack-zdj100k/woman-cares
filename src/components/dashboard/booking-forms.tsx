"use client";

import { useActionState, useState, useTransition } from "react";
import { respondBookingAction, type RespondState } from "@/app/[locale]/booking/actions";
import {
  answerProposalAction,
  clientCancelAction,
  closeVisitAction,
  freeSlotsAction,
  proposeTimeAction,
  providerCancelAction,
  reviewAction,
  visitPaymentAction,
  updateGuestAction,
  moveBookingAction,
  agreedPriceAction,
  deleteBookingAction,
  type BookingActionState,
} from "@/app/[locale]/dashboard/booking-actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnnounce } from "@/components/ui/decision-feedback";
import { cn } from "@/lib/utils";
import type { BookingLabels } from "./booking-labels";

const field = "grid gap-1.5 text-sm";
const area = "min-h-20 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none";
const select = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none [&>option]:bg-popover";

/** Wraps a server action so success and failure are both announced to screen readers. */
function useBookingAction(fn: (p: BookingActionState, f: FormData) => Promise<BookingActionState>, done: string, l: BookingLabels) {
  const announce = useAnnounce();
  return useActionState<BookingActionState, FormData>(async (prev, form) => {
    const next = await fn(prev, form);
    announce(next.status === "done" ? done : next.status === "error" ? (l.errors[next.code] ?? l.errors.generic) : "");
    return next;
  }, { status: "idle" });
}

function Feedback({ state, l }: { state: BookingActionState | RespondState; l: BookingLabels }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {l.errors[state.code] ?? l.errors.generic}
    </p>
  );
}

// ───────────── Client ─────────────

export function ClientCancelForm({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useBookingAction(clientCancelAction, l.cancelled, l);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ variant: "outline", size: "sm" })}>
        {l.cancel}
      </button>
    );
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={field}>
        {l.reasonOptional}
        <textarea name="reason" maxLength={500} className={area} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.cancelConfirm}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {l.back}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

export function ProposalAnswer({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const [state, action, pending] = useBookingAction(answerProposalAction, l.proposalAccepted, l);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="accept" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.acceptProposal}
        </button>
        <button type="submit" name="decision" value="decline" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          {l.declineProposal}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

export function ReviewForm({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const [rating, setRating] = useState(0);
  const [state, action, pending] = useBookingAction(reviewAction, l.reviewDone, l);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <fieldset>
        <legend className="mb-2 text-sm">{l.reviewRating}</legend>
        <div className="flex gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" title={l.stars[n - 1]}>
              <input type="radio" name="rating" value={n} required checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
              <span aria-hidden="true" className={cn("text-2xl leading-none transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring", n <= rating ? "text-chart-1" : "text-muted-foreground/40")}>
                ★
              </span>
              <span className="sr-only">{l.stars[n - 1]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={field}>
        {l.reviewComment}
        <textarea name="comment" maxLength={1000} className={area} />
      </label>
      <div>
        <button type="submit" disabled={pending || rating === 0} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.reviewSend}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

// ───────────── Professional ─────────────

export function RespondForm({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const announce = useAnnounce();
  const [state, action, pending] = useActionState<RespondState, FormData>(async (prev, form) => {
    const next = await respondBookingAction(prev, form);
    announce(next.status === "done" ? l.closed : "");
    return next;
  }, { status: "idle" });
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={field}>
        {l.note}
        <textarea name="note" maxLength={500} className={area} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="accept" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.accept}
        </button>
        <button type="submit" name="decision" value="reject" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          {l.reject}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

export function ProposeTimeForm({ bookingId, minDate, maxDate, locale, l }: { bookingId: string; minDate: string; maxDate: string; locale: string; l: BookingLabels }) {
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, action, pending] = useBookingAction(proposeTimeAction, l.proposedDone, l);
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" });
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className={field}>
          {l.proposeDate}
          <Input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => (setDate(e.target.value), setSlots(null))} className="w-[11rem]" />
        </label>
        <button type="button" disabled={loading || !date} onClick={() => startLoading(async () => setSlots(await freeSlotsAction(bookingId, date)))} className={buttonClass({ variant: "outline", size: "sm" })}>
          {l.proposeLoad}
        </button>
      </div>
      {slots && slots.length === 0 && <p className="text-sm text-muted-foreground">{l.proposeNone}</p>}
      {slots && slots.length > 0 && (
        <fieldset className="flex flex-wrap gap-2" dir="ltr">
          {slots.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="startAt" value={s} required className="peer sr-only" />
              <span className="inline-block rounded-full border border-border px-3 py-1.5 text-sm tabular-nums transition-colors peer-checked:border-chart-1 peer-checked:bg-chart-1/15 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring hover:bg-white/5">
                {fmt.format(new Date(s))}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {slots && slots.length > 0 && (
        <>
          <label className={field}>
            {l.note}
            <textarea name="note" maxLength={500} className={area} />
          </label>
          <div>
            <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
              {l.proposeSend}
            </button>
          </div>
        </>
      )}
      <Feedback state={state} l={l} />
    </form>
  );
}

export function ProviderCancelForm({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useBookingAction(providerCancelAction, l.closed, l);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ variant: "outline", size: "sm" })}>
        {l.providerCancel}
      </button>
    );
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={field}>
        {l.reason}
        <textarea name="reason" required minLength={3} maxLength={500} className={area} />
        <span className="text-xs text-muted-foreground">{l.providerCancelHint}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.cancelConfirm}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {l.back}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

export function CloseVisitForm({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const [state, action, pending] = useBookingAction(closeVisitAction, l.closed, l);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="outcome" value="COMPLETED" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.complete}
        </button>
        <button type="submit" name="outcome" value="NO_SHOW" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          {l.noShow}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

export function VisitPaymentForm({ bookingId, l }: { bookingId: string; l: BookingLabels }) {
  const [state, action, pending] = useBookingAction(visitPaymentAction, l.recorded, l);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,10rem)_minmax(0,1fr)] sm:items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={field}>
        {l.amount}
        <Input name="amount" inputMode="decimal" required className="tabular-nums" />
      </label>
      <label className={field}>
        {l.method}
        <select name="method" className={select} defaultValue="cash">
          {Object.entries(l.methods).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {l.note}
        <Input name="note" maxLength={300} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="refund" className="accent-[var(--chart-1)]" />
        {l.refund}
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.record}
        </button>
        <Feedback state={state} l={l} />
      </div>
    </form>
  );
}

/** 24-hour quarter-hour choices, the same in every browser. */
export const QUARTERS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** A client the professional added by hand: name and phone, editable at any time. */
export function GuestForm({ bookingId, name, phone, l }: { bookingId: string; name: string; phone: string; l: BookingLabels }) {
  const [state, action, pending] = useBookingAction(updateGuestAction, l.guestSaved, l);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={field}>
        {l.columns.client}
        <Input name="guestName" defaultValue={name} required minLength={2} maxLength={120} />
      </label>
      <label className={field}>
        {l.phone}
        <Input name="guestPhone" defaultValue={phone} inputMode="tel" dir="ltr" maxLength={24} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
        {l.guestSave}
      </button>
      <div className="sm:col-span-3">
        <Feedback state={state} l={l} />
      </div>
    </form>
  );
}

/** Moves the appointment to any day and hour, directly (the client is told). */
export function MoveForm({ bookingId, day, time, duration, l }: { bookingId: string; day: string; time: string; duration: number; l: BookingLabels }) {
  const [state, action, pending] = useBookingAction(moveBookingAction, l.moved, l);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-xs text-muted-foreground">{l.moveHint}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className={field}>
          {l.proposeDate}
          <Input type="date" name="day" defaultValue={day} required dir="ltr" className="w-[11rem]" />
        </label>
        <label className={field}>
          {l.time}
          <select name="time" defaultValue={time} className={select} dir="ltr">
            {QUARTERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          {l.duration}
          <Input name="duration" type="number" min={10} max={720} step={5} defaultValue={duration} className="w-24 tabular-nums" />
        </label>
      </div>
      <label className={field}>
        {l.note}
        <Input name="note" maxLength={500} />
      </label>
      <div>
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.moveSave}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

export function AgreedPriceForm({ bookingId, price, l }: { bookingId: string; price: string; l: BookingLabels }) {
  const [state, action, pending] = useBookingAction(agreedPriceAction, l.agreedSaved, l);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-xs text-muted-foreground">{l.agreedHint}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className={field}>
          {l.amount}
          <Input name="price" defaultValue={price} inputMode="decimal" className="w-40 tabular-nums" />
        </label>
        <label className={cn(field, "min-w-[12rem] flex-1")}>
          {l.note}
          <Input name="note" maxLength={500} />
        </label>
        <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
          {l.agreedSave}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}

/** Deletes this booking from her agenda (confirmation first). */
export function DeleteBookingForm({ bookingId, next, l }: { bookingId: string; next: string; l: BookingLabels }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useBookingAction(deleteBookingAction, l.removed, l);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ variant: "outline", size: "sm", className: "justify-self-start text-destructive" })}>
        {l.remove}
      </button>
    );
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="next" value={next} />
      <p className="text-sm text-muted-foreground">{l.removeConfirm}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass({ variant: "solid", size: "sm" })}>
          {l.remove}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {l.back}
        </button>
      </div>
      <Feedback state={state} l={l} />
    </form>
  );
}
