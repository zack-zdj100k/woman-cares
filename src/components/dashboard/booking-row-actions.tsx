"use client";

import { useActionState } from "react";
import Link from "next/link";
import { respondBookingAction, type RespondState } from "@/app/[locale]/booking/actions";
import { deleteBookingAction, providerCancelAction, type BookingActionState } from "@/app/[locale]/dashboard/booking-actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Labels = { open: string; accept: string; reject: string; cancel: string; cancelConfirm: string; reason: string; remove: string; removeConfirm: string; errors: Record<string, string> };

/**
 * Quick actions on one row of her bookings table: answer a request, cancel a confirmed appointment
 * (with a reason the client receives), delete a booking she added or one that is over.
 */
export function BookingRowActions({ bookingId, canRespond, canCancel, canDelete, openHref, labels }: { bookingId: string; canRespond: boolean; canCancel: boolean; canDelete: boolean; openHref: string; labels: Labels }) {
  const [respond, respondAction, responding] = useActionState<RespondState, FormData>(respondBookingAction, { status: "idle" });
  const [cancel, cancelAction, cancelling] = useActionState<BookingActionState, FormData>(providerCancelAction, { status: "idle" });
  const [remove, removeAction, removing] = useActionState<BookingActionState, FormData>(deleteBookingAction, { status: "idle" });
  const error = [respond, cancel, remove].find((s) => s.status === "error") as { code: string } | undefined;
  const small = buttonClass({ variant: "outline", size: "xs" });
  return (
    <div className="grid justify-items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {canRespond && (
          <form action={respondAction} className="flex gap-1.5">
            <input type="hidden" name="bookingId" value={bookingId} />
            <button type="submit" name="decision" value="accept" disabled={responding} className={buttonClass({ variant: "solid", size: "xs" })}>
              {labels.accept}
            </button>
            <button type="submit" name="decision" value="reject" disabled={responding} className={small}>
              {labels.reject}
            </button>
          </form>
        )}
        <Link href={openHref} className={small}>
          {labels.open}
        </Link>
        {canCancel && (
          <details className="group relative">
            <summary className={cn(small, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>{labels.cancel}</summary>
            <form action={cancelAction} className="absolute end-0 top-10 z-20 grid w-64 gap-2 rounded-xl border border-border bg-popover p-3 shadow-xl">
              <input type="hidden" name="bookingId" value={bookingId} />
              <label className="grid gap-1 text-xs">
                {labels.reason}
                <textarea name="reason" required minLength={3} maxLength={500} rows={3} className="rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm focus-visible:border-ring focus-visible:outline-none" />
              </label>
              <button type="submit" disabled={cancelling} className={buttonClass({ variant: "solid", size: "sm" })}>
                {labels.cancelConfirm}
              </button>
            </form>
          </details>
        )}
        {canDelete && (
          <details className="group relative">
            <summary className={cn(small, "cursor-pointer list-none text-destructive [&::-webkit-details-marker]:hidden")}>{labels.remove}</summary>
            <form action={removeAction} className="absolute end-0 top-10 z-20 grid w-64 gap-2 rounded-xl border border-border bg-popover p-3 text-xs shadow-xl">
              <input type="hidden" name="bookingId" value={bookingId} />
              <p className="text-muted-foreground">{labels.removeConfirm}</p>
              <button type="submit" disabled={removing} className={buttonClass({ variant: "solid", size: "sm" })}>
                {labels.remove}
              </button>
            </form>
          </details>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {labels.errors[error.code] ?? labels.errors.generic}
        </p>
      )}
    </div>
  );
}
