"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { BOOKING_REQUIRES_VERIFIED_EMAIL } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { BookingBlocked, requestBooking, respondToBooking } from "@/server/services/bookings";
import { deliverPendingEmails } from "@/server/services/outbox";

export type BookingState =
  | { status: "idle" }
  | { status: "done"; id: string; reference: string }
  | { status: "error"; code: "signin" | "verify" | "slot" | "limit" | "profile" | "service" | "role" | "rate" | "generic" };

export async function requestBookingAction(_prev: BookingState, form: FormData): Promise<BookingState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "signin" };
  if (BOOKING_REQUIRES_VERIFIED_EMAIL && user.role === "CLIENT" && !user.emailVerified) return { status: "error", code: "verify" };
  if (!rateLimit(`booking:${user.id}`, 10, 10 * 60_000).ok) return { status: "error", code: "rate" };
  try {
    const result = await requestBooking(user, {
      profileSlug: String(form.get("profile") ?? ""),
      serviceId: String(form.get("serviceId") ?? ""),
      startAt: String(form.get("startAt") ?? ""),
      note: String(form.get("note") ?? "") || null,
      idempotencyKey: String(form.get("key") ?? ""),
    });
    after(() => deliverPendingEmails().catch(() => {}));
    return { status: "done", id: result.id, reference: result.reference };
  } catch (e) {
    if (e instanceof BookingBlocked) return { status: "error", code: e.reason === "state" ? "generic" : e.reason === "full" ? "slot" : e.reason };
    throw e;
  }
}

export type RespondState = { status: "idle" } | { status: "done"; at: number } | { status: "error"; code: "state" | "forbidden" };

export async function respondBookingAction(_prev: RespondState, form: FormData): Promise<RespondState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", code: "forbidden" };
  try {
    await respondToBooking(user, String(form.get("bookingId") ?? ""), form.get("decision") === "accept", String(form.get("note") ?? "") || null);
  } catch (e) {
    if (e instanceof BookingBlocked) return { status: "error", code: "state" };
    if (e instanceof ForbiddenError) return { status: "error", code: "forbidden" };
    throw e;
  }
  after(() => deliverPendingEmails().catch(() => {}));
  updateTag("bookings");
  refresh();
  return { status: "done", at: Date.now() };
}
