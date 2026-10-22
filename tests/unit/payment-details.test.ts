import { describe, expect, it } from "vitest";
import { formatRip, normalizeHolder, normalizeRip, paymentDetailsAreAuthentic, signPaymentDetails } from "@/lib/payment-details";
import { canManageSiteSettings } from "@/server/policies/roles";

describe("account number rules", () => {
  it("keeps digits and drops the separators people type", () => {
    expect(normalizeRip("007 99999 0012345678 12")).toBe("00799999001234567812");
    expect(normalizeRip("0079-9999.0012345678/12")).toBe("00799999001234567812");
  });

  it("refuses letters, short and over-long numbers", () => {
    expect(normalizeRip("0079999900123456781A")).toBeNull();
    expect(normalizeRip("12345")).toBeNull();
    expect(normalizeRip("1".repeat(25))).toBeNull();
    expect(normalizeRip("")).toBeNull();
  });

  it("shows 20 digits as bank, agency, account and key, anything else in fours", () => {
    expect(formatRip("00799999001234567812")).toBe("007 99999 0012345678 12");
    expect(formatRip("1234567890123")).toBe("1234 5678 9012 3");
  });

  it("cleans a holder name and refuses empty or huge ones", () => {
    expect(normalizeHolder("  Nadia   <b>Kaci</b>\n")).toBe("Nadia b Kaci /b");
    expect(normalizeHolder("نادية قاسي")).toBe("نادية قاسي");
    expect(normalizeHolder(" ")).toBeNull();
    expect(normalizeHolder("x")).toBeNull();
    expect(normalizeHolder("x".repeat(81))).toBeNull();
  });
});

describe("tamper-evident signature", () => {
  const d = { holder: "Nadia Kaci", rip: "00799999001234567812", updatedAt: "2026-10-22T10:00:00.000Z" };

  it("accepts what was signed", () => {
    expect(paymentDetailsAreAuthentic(d, signPaymentDetails(d))).toBe(true);
  });

  it("rejects a changed number, name or date", () => {
    const sig = signPaymentDetails(d);
    expect(paymentDetailsAreAuthentic({ ...d, rip: "00799999009999999912" }, sig)).toBe(false);
    expect(paymentDetailsAreAuthentic({ ...d, holder: "Someone Else" }, sig)).toBe(false);
    expect(paymentDetailsAreAuthentic({ ...d, updatedAt: "2026-10-23T10:00:00.000Z" }, sig)).toBe(false);
  });

  it("rejects a missing, malformed or forged signature", () => {
    expect(paymentDetailsAreAuthentic(d, undefined)).toBe(false);
    expect(paymentDetailsAreAuthentic(d, "")).toBe(false);
    expect(paymentDetailsAreAuthentic(d, "zz".repeat(32))).toBe(false);
    expect(paymentDetailsAreAuthentic(d, "0".repeat(64))).toBe(false);
  });

  it("cannot be confused by moving a character between fields", () => {
    const a = { holder: "AB", rip: "1234567890", updatedAt: "t" };
    const b = { holder: "A", rip: "B1234567890", updatedAt: "t" };
    expect(signPaymentDetails(a)).not.toBe(signPaymentDetails(b));
  });
});

describe("who may manage site settings", () => {
  const base = { id: "u", status: "ACTIVE" as const, emailVerified: true };
  it("is a verified Super Admin only", () => {
    expect(canManageSiteSettings({ ...base, role: "SUPER_ADMIN" })).toBe(true);
    for (const role of ["ADMIN", "SUPPORT", "PROVIDER", "CLIENT"] as const) expect(canManageSiteSettings({ ...base, role })).toBe(false);
    expect(canManageSiteSettings({ ...base, role: "SUPER_ADMIN", emailVerified: false })).toBe(false);
    expect(canManageSiteSettings({ ...base, role: "SUPER_ADMIN", status: "SUSPENDED" })).toBe(false);
  });
});
