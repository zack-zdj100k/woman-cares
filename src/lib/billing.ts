/**
 * Subscription billing rules (pure). See docs/DASHBOARD_SPECIFICATION.md › Subscriptions and billing.
 * Amounts are whole dinars (numbers); persistence uses Decimal(12, 2).
 */

export type Basis = "PER_CATEGORY" | "PACKAGE" | "NEGOTIATED" | "PROMOTIONAL" | "EXEMPT";
export type SubStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "GRACE" | "EXPIRED" | "CANCELLED" | "SUSPENDED" | "EXEMPT";

export type BillableCategory = { categoryId: string; slug: string; name: string; monthlyPrice: number };
export type Line = { categoryId: string | null; description: string; amount: number };

/** Same day next month (clamped to the month's last day), in UTC. */
export function addMonths(d: Date, n: number) {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + n);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/**
 * Lines of one monthly invoice.
 *  - PER_CATEGORY / PROMOTIONAL: one line per billable category at its price in effect;
 *  - NEGOTIATED: one line with the agreed amount (whatever the number of categories);
 *  - PACKAGE: one line with the package price;
 *  - EXEMPT, or nothing billable: no lines (no invoice is issued).
 */
export function invoiceLines(input: {
  basis: Basis;
  categories: BillableCategory[];
  negotiatedPrice: number | null;
  packagePrice: number | null;
  labels: { negotiated: string; package: string; category: (name: string) => string };
}): { lines: Line[]; total: number } {
  const { basis, categories } = input;
  if (basis === "EXEMPT") return { lines: [], total: 0 };
  // An agreed price is what was agreed, published profiles or not (one amount for all her categories).
  if (basis === "NEGOTIATED" && input.negotiatedPrice !== null && input.negotiatedPrice > 0) {
    return { lines: [{ categoryId: null, description: input.labels.negotiated, amount: input.negotiatedPrice }], total: input.negotiatedPrice };
  }
  if (categories.length === 0) return { lines: [], total: 0 };
  let lines: Line[];
  if (basis === "PACKAGE" && input.packagePrice !== null) lines = [{ categoryId: null, description: input.labels.package, amount: input.packagePrice }];
  else lines = categories.map((c) => ({ categoryId: c.categoryId, description: input.labels.category(c.name), amount: c.monthlyPrice }));
  lines = lines.filter((l) => l.amount > 0);
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}

/**
 * Status from the facts. Admin decisions (EXEMPT, SUSPENDED, CANCELLED) stay as they are. An unpaid
 * invoice past its due date starts the grace period; once grace ends the subscription expires.
 */
export function billingStatus(input: {
  status: SubStatus;
  trialEndsAt: Date | null;
  oldestUnpaidDueAt: Date | null;
  graceDays: number;
  now: Date;
}): { status: SubStatus; graceEndsAt: Date | null } {
  const { status, now } = input;
  if (status === "EXEMPT" || status === "SUSPENDED" || status === "CANCELLED") return { status, graceEndsAt: null };
  if (input.oldestUnpaidDueAt && input.oldestUnpaidDueAt <= now) {
    const graceEndsAt = new Date(input.oldestUnpaidDueAt.getTime() + input.graceDays * 86_400_000);
    return { status: now < graceEndsAt ? "GRACE" : "EXPIRED", graceEndsAt };
  }
  if (input.trialEndsAt && input.trialEndsAt > now) return { status: "TRIALING", graceEndsAt: null };
  return { status: "ACTIVE", graceEndsAt: null };
}

/** Whether profiles of a professional in this state appear in the public directory. */
export function isPubliclyVisible(status: SubStatus) {
  return status !== "EXPIRED" && status !== "SUSPENDED" && status !== "CANCELLED";
}

/** Short, unique-enough human invoice number: WC-202610-7K3P9Q. */
export function invoiceNumber(periodStart: Date, random: string) {
  return `WC-${periodStart.toISOString().slice(0, 7).replace("-", "")}-${random}`;
}
