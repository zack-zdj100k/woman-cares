"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { parseAmount } from "@/lib/booking-rules";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { answerProposal, cancelByClient, cancelByProvider, closeVisit, freeSlotsForBooking, leaveReview, proposeTime, recordVisitPayment } from "@/server/services/booking-lifecycle";
import { BookingBlocked } from "@/server/services/bookings";
import { deliverPendingEmails } from "@/server/services/outbox";

export type BookingActionState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; code: string };

async function run(fn: (user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<unknown>): Promise<BookingActionState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  if (!rateLimit(`booking-action:${user.id}`, 30, 10 * 60_000).ok) return { status: "error", code: "generic" };
  try {
    await fn(user);
  } catch (e) {
    if (e instanceof BookingBlocked) return { status: "error", code: e.reason === "slot" || e.reason === "service" ? e.reason : "state" };
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
