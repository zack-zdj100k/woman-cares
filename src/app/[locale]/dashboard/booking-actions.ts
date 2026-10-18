"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { parseAmount } from "@/lib/booking-rules";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { answerProposal, cancelByClient, cancelByProvider, closeVisit, freeSlotsForBooking, leaveReview, proposeTime, recordVisitPayment } from "@/server/services/booking-lifecycle";
import { BookingBlocked } from "@/server/services/bookings";
import { createManualBooking, deleteBooking, moveBooking, setAgreedPrice, updateGuest } from "@/server/services/booking-manual";
import { deliverPendingEmails } from "@/server/services/outbox";

export type BookingActionState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; code: string };

async function run(fn: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<unknown>): Promise<BookingActionState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  if (!rateLimit(`booking-action:${user.id}`, 30, 10 * 60_000).ok) return { status: "error", code: "generic" };
  try {
    await fn(user);
  } catch (e) {
    if (e instanceof BookingBlocked) return { status: "error", code: e.reason === "slot" || e.reason === "service" || e.reason === "full" ? e.reason : "state" };
    if (e instanceof ForbiddenError) return { status: "error", code: "forbidden" };
    throw e;
  }
  after(() => deliverPendingEmails().catch(() => {}));
  updateTag("bookings");
  refresh();
  return { status: "done", at: Date.now() };
}

const id = (form: FormData) => String(form.get("bookingId") ?? "");
const text = (form: FormData, key: string) => String(form.get(key) ?? "") || null;

export async function clientCancelAction(_p: BookingActionState, form: FormData) {
  return run((u) => cancelByClient(u, id(form), text(form, "reason")));
}

export async function answerProposalAction(_p: BookingActionState, form: FormData) {
  return run((u) => answerProposal(u, id(form), form.get("decision") === "accept"));
}

export async function reviewAction(_p: BookingActionState, form: FormData) {
  return run((u) => leaveReview(u, id(form), Number(form.get("rating")), text(form, "comment")));
}

export async function providerCancelAction(_p: BookingActionState, form: FormData) {
  return run((u) => cancelByProvider(u, id(form), text(form, "reason")));
}

export async function proposeTimeAction(_p: BookingActionState, form: FormData) {
  return run((u) => proposeTime(u, id(form), String(form.get("startAt") ?? ""), text(form, "note")));
}

export async function closeVisitAction(_p: BookingActionState, form: FormData) {
  return run((u) => closeVisit(u, id(form), form.get("outcome") === "NO_SHOW" ? "NO_SHOW" : "COMPLETED"));
}

export async function visitPaymentAction(_p: BookingActionState, form: FormData) {
  const amount = parseAmount(String(form.get("amount") ?? ""));
  if (amount === null) return { status: "error", code: "service" } as const;
  return run((u) => recordVisitPayment(u, id(form), { amount, method: String(form.get("method") ?? ""), refund: form.get("refund") === "on", note: text(form, "note") }));
}

/** Free times for the "propose another time" picker. */
export async function freeSlotsAction(bookingId: string, date: string): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return [];
  try {
    return await freeSlotsForBooking(user, bookingId, date);
  } catch (e) {
    if (e instanceof ForbiddenError) return [];
    throw e;
  }
}

// ───────────── Professional calendar tools ─────────────

const optionalNumber = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? Number(s.replace(/\s/g, "")) : null;
};

export type ManualState = BookingActionState | { status: "created"; id: string; day: string };

/** Adds an appointment by hand, then returns to the calendar week of that day. */
export async function manualBookingAction(_p: ManualState, form: FormData): Promise<ManualState> {
  const day = String(form.get("day") ?? "");
  let created: { id: string } | null = null;
  const state = await run(async (u) => {
    created = await createManualBooking(u, {
      serviceId: String(form.get("serviceId") ?? "") || null,
      profileId: String(form.get("profileId") ?? "") || null,
      serviceName: String(form.get("serviceName") ?? ""),
      day,
      time: String(form.get("time") ?? ""),
      durationMinutes: optionalNumber(form.get("duration")),
      guestName: String(form.get("guestName") ?? ""),
      guestPhone: String(form.get("guestPhone") ?? ""),
      note: text(form, "note"),
      price: optionalNumber(form.get("price")),
    });
  });
  if (state.status !== "done" || !created) return state;
  const locale = String(form.get("locale") ?? "fr") === "ar" ? "ar" : "fr";
  redirect(`/${locale}/dashboard/provider/calendar?week=${day}&added=${(created as { id: string }).id}`);
}

export async function updateGuestAction(_p: BookingActionState, form: FormData) {
  return run((u) => updateGuest(u, id(form), { guestName: String(form.get("guestName") ?? ""), guestPhone: String(form.get("guestPhone") ?? "") }));
}

export async function moveBookingAction(_p: BookingActionState, form: FormData) {
  return run((u) => moveBooking(u, id(form), { day: String(form.get("day") ?? ""), time: String(form.get("time") ?? ""), durationMinutes: optionalNumber(form.get("duration")), note: text(form, "note") }));
}

export async function agreedPriceAction(_p: BookingActionState, form: FormData) {
  const raw = String(form.get("price") ?? "").trim();
  const price = raw ? parseAmount(raw) : null;
  if (raw && price === null) return { status: "error", code: "service" } as const;
  return run((u) => setAgreedPrice(u, id(form), price, text(form, "note")));
}

/** Deletes a booking from her agenda; from its own page, returns to the list. */
export async function deleteBookingAction(_p: BookingActionState, form: FormData): Promise<BookingActionState> {
  const state = await run((u) => deleteBooking(u, id(form)));
  const next = String(form.get("next") ?? "");
  if (state.status === "done" && next.startsWith("/") && !next.startsWith("//")) redirect(next);
  return state;
}
