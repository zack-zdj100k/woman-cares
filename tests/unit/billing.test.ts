import { describe, expect, it } from "vitest";
import { addMonths, billingStatus, invoiceLines, isPubliclyVisible } from "@/lib/billing";

const labels = { negotiated: "Prix convenu", package: "Formule", category: (n: string) => `Abonnement ${n}` };
const cats = [
  { categoryId: "c1", slug: "nails", name: "Ongles", monthlyPrice: 30000 },
  { categoryId: "c2", slug: "coiffeuses", name: "Coiffure", monthlyPrice: 25000 },
];

describe("invoice lines", () => {
  it("bills each published category at its price by default", () => {
    const r = invoiceLines({ basis: "PER_CATEGORY", categories: cats, negotiatedPrice: null, packagePrice: null, labels });
    expect(r.total).toBe(55000);
    expect(r.lines.map((l) => l.description)).toEqual(["Abonnement Ongles", "Abonnement Coiffure"]);
  });

  it("uses one agreed monthly amount, whatever the number of categories", () => {
    const r = invoiceLines({ basis: "NEGOTIATED", categories: cats, negotiatedPrice: 20000, packagePrice: null, labels });
    expect(r).toEqual({ lines: [{ categoryId: null, description: "Prix convenu", amount: 20000 }], total: 20000 });
  });

  it("bills nothing when exempt or when nothing is published", () => {
    expect(invoiceLines({ basis: "EXEMPT", categories: cats, negotiatedPrice: null, packagePrice: null, labels }).total).toBe(0);
    expect(invoiceLines({ basis: "PER_CATEGORY", categories: [], negotiatedPrice: null, packagePrice: null, labels }).lines).toEqual([]);
    expect(invoiceLines({ basis: "NEGOTIATED", categories: [], negotiatedPrice: 20000, packagePrice: null, labels }).total).toBe(0);
  });
});

describe("subscription status over time", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  const base = { status: "ACTIVE" as const, trialEndsAt: null, graceDays: 7, now };

  it("stays in trial until the trial ends, then becomes active", () => {
    expect(billingStatus({ ...base, status: "TRIALING", trialEndsAt: new Date("2026-11-25T00:00:00Z"), oldestUnpaidDueAt: null }).status).toBe("TRIALING");
    expect(billingStatus({ ...base, status: "TRIALING", trialEndsAt: new Date("2026-11-01T00:00:00Z"), oldestUnpaidDueAt: null }).status).toBe("ACTIVE");
  });

  it("starts the grace period after the due date, then expires", () => {
    const grace = billingStatus({ ...base, oldestUnpaidDueAt: new Date("2026-11-18T00:00:00Z") });
    expect(grace.status).toBe("GRACE");
    expect(grace.graceEndsAt?.toISOString()).toBe("2026-11-25T00:00:00.000Z");
    expect(billingStatus({ ...base, oldestUnpaidDueAt: new Date("2026-11-10T00:00:00Z") }).status).toBe("EXPIRED");
    expect(billingStatus({ ...base, oldestUnpaidDueAt: new Date("2026-11-25T00:00:00Z") }).status).toBe("ACTIVE");
  });

  it("never overrides admin decisions", () => {
    for (const s of ["EXEMPT", "SUSPENDED", "CANCELLED"] as const) {
      expect(billingStatus({ ...base, status: s, oldestUnpaidDueAt: new Date("2026-01-01T00:00:00Z") }).status).toBe(s);
    }
  });

  it("hides profiles only when expired, suspended or cancelled", () => {
    expect(["TRIALING", "ACTIVE", "GRACE", "EXEMPT"].every((s) => isPubliclyVisible(s as never))).toBe(true);
    expect(["EXPIRED", "SUSPENDED", "CANCELLED"].some((s) => isPubliclyVisible(s as never))).toBe(false);
  });
});

describe("months", () => {
  it("keeps the day, clamped at month end", () => {
    expect(addMonths(new Date("2026-01-31T23:00:00Z"), 1).toISOString()).toBe("2026-02-28T23:00:00.000Z");
    expect(addMonths(new Date("2026-11-15T23:00:00Z"), 1).toISOString()).toBe("2026-12-15T23:00:00.000Z");
    expect(addMonths(new Date("2026-12-15T23:00:00Z"), 1).toISOString()).toBe("2027-01-15T23:00:00.000Z");
  });
});
