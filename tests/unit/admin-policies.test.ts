import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canManageCatalog,
  canSuspendFrom,
  canViewAudit,
  canViewCatalog,
  canViewUsers,
  type Actor,
  type Role,
} from "@/server/policies/roles";
import { algiersMidnight, algiersToday, isIsoDay, isValidPriceStart, parsePrice, priceStates } from "@/lib/pricing-dates";

const actor = (role: Role, o: Partial<Actor> = {}): Actor => ({ id: "me", role, status: "ACTIVE", emailVerified: true, ...o });
const target = (role: Role, id = "them") => ({ id, role });

describe("admin area policies", () => {
  it("lets verified staff read users, categories and prices; never clients or providers", () => {
    for (const r of ["SUPPORT", "ADMIN", "SUPER_ADMIN"] as const) {
      expect(canViewUsers(actor(r))).toBe(true);
      expect(canViewCatalog(actor(r))).toBe(true);
    }
    for (const r of ["CLIENT", "PROVIDER"] as const) {
      expect(canViewUsers(actor(r))).toBe(false);
      expect(canViewCatalog(actor(r))).toBe(false);
    }
    expect(canViewUsers(actor("ADMIN", { emailVerified: false }))).toBe(false);
    expect(canViewUsers(actor("SUPER_ADMIN", { status: "SUSPENDED" }))).toBe(false);
  });

  it("limits catalog changes and the audit log to ADMIN and above", () => {
    expect(canManageCatalog(actor("SUPPORT"))).toBe(false);
    expect(canManageCatalog(actor("ADMIN"))).toBe(true);
    expect(canManageCatalog(actor("SUPER_ADMIN"))).toBe(true);
    expect(canManageCatalog(actor("PROVIDER"))).toBe(false);
    expect(canManageCatalog(actor("ADMIN", { emailVerified: false }))).toBe(false);
    expect(canViewAudit(actor("SUPPORT"))).toBe(false);
    expect(canViewAudit(actor("ADMIN"))).toBe(true);
    expect(canViewAudit(actor("SUPER_ADMIN"))).toBe(true);
    expect(canViewAudit(actor("CLIENT"))).toBe(false);
  });

  it("offers only the roles the policy allows", () => {
    expect(assignableRoles(actor("SUPER_ADMIN"), target("CLIENT"))).toEqual(["PROVIDER", "SUPPORT", "ADMIN", "SUPER_ADMIN"]);
    expect(assignableRoles(actor("SUPER_ADMIN"), target("ADMIN"))).toEqual(["CLIENT", "PROVIDER", "SUPPORT", "SUPER_ADMIN"]);
    expect(assignableRoles(actor("ADMIN"), target("CLIENT"))).toEqual(["PROVIDER"]);
    expect(assignableRoles(actor("ADMIN"), target("PROVIDER"))).toEqual(["CLIENT"]);
    expect(assignableRoles(actor("ADMIN"), target("SUPPORT"))).toEqual([]);
    expect(assignableRoles(actor("SUPPORT"), target("CLIENT"))).toEqual([]);
    // Nobody changes their own role, not even a Super Admin.
    expect(assignableRoles(actor("SUPER_ADMIN"), target("SUPER_ADMIN", "me"))).toEqual([]);
  });

  it("suspends only accounts that can sign in", () => {
    expect(canSuspendFrom("ACTIVE")).toBe(true);
    expect(canSuspendFrom("PENDING_VERIFICATION")).toBe(true);
    expect(canSuspendFrom("SUSPENDED")).toBe(false);
    expect(canSuspendFrom("DEACTIVATED")).toBe(false);
  });
});

describe("price effective dates (Algiers days)", () => {
  it("reads the calendar day in Algiers, not in UTC", () => {
    expect(algiersToday(new Date("2026-10-16T22:59:00Z"))).toBe("2026-10-16");
    expect(algiersToday(new Date("2026-10-16T23:00:00Z"))).toBe("2026-10-17");
    expect(algiersMidnight("2026-11-01").toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("accepts tomorrow up to two years ahead, never today or the past", () => {
    const today = "2026-10-16";
    expect(isValidPriceStart("2026-10-17", today)).toBe(true);
    expect(isValidPriceStart("2028-10-15", today)).toBe(true);
    expect(isValidPriceStart("2026-10-16", today)).toBe(false);
    expect(isValidPriceStart("2026-01-01", today)).toBe(false);
    expect(isValidPriceStart("2029-01-01", today)).toBe(false);
    expect(isValidPriceStart("2026-02-30", today)).toBe(false);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("17/10/2026")).toBe(false);
  });

  it("parses whole dinars only", () => {
    expect(parsePrice("30000")).toBe(30000);
    expect(parsePrice("35 000")).toBe(35000);
    expect(parsePrice("0")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("29999.50")).toBeNull();
    expect(parsePrice("2000000")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });

  it("labels the row in effect, past rows, upcoming rows and same-day replacements", () => {
    const row = (id: string, day: string, created: string) => ({ id, effectiveFrom: algiersMidnight(day), createdAt: new Date(created) });
    const rows = [
      row("seed", "2026-01-01", "2026-01-01T00:00:00Z"),
      row("oct", "2026-10-01", "2026-09-20T10:00:00Z"),
      row("nov-typo", "2026-11-01", "2026-10-10T10:00:00Z"),
      row("nov", "2026-11-01", "2026-10-11T10:00:00Z"),
      row("dec", "2026-12-01", "2026-10-11T11:00:00Z"),
    ];
    const s = priceStates(rows, "2026-10-16");
    expect(Object.fromEntries(s)).toEqual({ seed: "past", oct: "current", "nov-typo": "replaced", nov: "upcoming", dec: "upcoming" });
    // At midnight the next row takes over.
    expect(priceStates(rows, "2026-11-01").get("nov")).toBe("current");
    expect(priceStates(rows, "2026-11-01").get("oct")).toBe("past");
  });
});
