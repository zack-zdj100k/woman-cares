/**
 * Which actions each side may take on a booking, from its state and the clock. Pure, so the UI and
 * the server share one rulebook; the server re-checks every action inside a status-guarded write.
 * State machine: docs/architecture/booking-state-machine.mmd.
 */
export type BookingStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED_BY_CLIENT"
  | "CANCELLED_BY_PROVIDER"
  | "RESCHEDULE_PROPOSED"
  | "COMPLETED"
  | "NO_SHOW"
  | "EXPIRED";

export type ClientAction = "cancel" | "acceptProposal" | "declineProposal" | "review";
export type ProviderAction = "respond" | "cancel" | "propose" | "complete" | "noShow" | "pay";

type State = { status: BookingStatus; startAt: Date; hasReview?: boolean };

export const PAYMENT_METHODS = ["cash", "transfer", "ccp", "baridimob", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function clientActions(b: State, now: Date): ClientAction[] {
  const future = b.startAt.getTime() > now.getTime();
  const out: ClientAction[] = [];
  if (b.status === "RESCHEDULE_PROPOSED") out.push("acceptProposal", "declineProposal");
  if (future && (b.status === "PENDING" || b.status === "ACCEPTED" || b.status === "RESCHEDULE_PROPOSED")) out.push("cancel");
  if (b.status === "COMPLETED" && !b.hasReview) out.push("review");
  return out;
}

export function providerActions(b: State, now: Date): ProviderAction[] {
  const future = b.startAt.getTime() > now.getTime();
  const out: ProviderAction[] = [];
  if (b.status === "PENDING" && future) out.push("respond");
  if (future && (b.status === "PENDING" || b.status === "ACCEPTED")) out.push("propose");
  if (future && (b.status === "ACCEPTED" || b.status === "RESCHEDULE_PROPOSED")) out.push("cancel");
  if (!future && b.status === "ACCEPTED") out.push("complete", "noShow");
  if (b.status === "COMPLETED") out.push("pay");
  return out;
}

/** Paid minus refunded; the booking's payment status follows from it. */
export function paymentSummary(rows: { amount: number; status: "PAID" | "REFUNDED" | string }[]) {
  const paid = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0);
  const refunded = rows.filter((r) => r.status === "REFUNDED").reduce((s, r) => s + r.amount, 0);
  const net = Math.round((paid - refunded) * 100) / 100;
  const status = net > 0 ? "PAID" : refunded > 0 ? "REFUNDED" : "UNPAID";
  return { paid, refunded, net, status } as const;
}

/** "1500", "1 500", "1500.50" → 1500.5; anything else (or ≤ 0, or above 10 million) → null. */
export function parseAmount(raw: string): number | null {
  const v = raw.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= 10_000_000 ? n : null;
}

/** Who the booking is for: the client's account name, or the name the professional typed for a manual booking. */
export function clientLabel(b: { client?: { fullName: string } | null; guestName?: string | null }) {
  return b.client?.fullName ?? b.guestName ?? "-";
}
