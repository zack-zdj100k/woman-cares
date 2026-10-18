import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  canChangeRole,
  canChangeStatus,
  canManageProviderResource,
  BOOKING_REQUIRES_VERIFIED_EMAIL,
  canRequestAppointment,
  canSignIn,
  canVerifyProvider,
  canViewBooking,
  hasStaffRank,
  homeArea,
  type Actor,
  type Role,
} from "@/server/policies/roles";
import { safeNextPath } from "@/lib/auth/redirects";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { hashToken, newToken } from "@/lib/auth/tokens";
import { clientSignUpSchema, normalizeDzPhone, providerSignUpSchema } from "@/lib/validation/auth";
import { renderEmail } from "@/lib/email/templates";

const actor = (role: Role, over: Partial<Actor> = {}): Actor => ({ id: `${role}-1`, role, status: "ACTIVE", emailVerified: true, ...over });

describe("role hierarchy and areas", () => {
  it("ranks staff SUPPORT < ADMIN < SUPER_ADMIN; clients and providers are not staff", () => {
    expect(hasStaffRank("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(hasStaffRank("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(hasStaffRank("SUPPORT", "SUPPORT")).toBe(true);
    expect(hasStaffRank("PROVIDER", "SUPPORT")).toBe(false);
  });

  it("opens each dashboard area only to its role", () => {
    expect(canAccessArea(actor("CLIENT"), "client")).toBe(true);
    expect(canAccessArea(actor("CLIENT"), "provider")).toBe(false);
    expect(canAccessArea(actor("CLIENT"), "admin")).toBe(false);
    expect(canAccessArea(actor("PROVIDER"), "provider")).toBe(true);
    expect(canAccessArea(actor("PROVIDER"), "admin")).toBe(false);
    expect(canAccessArea(actor("SUPPORT"), "admin")).toBe(true);
    expect(canAccessArea(actor("ADMIN", { emailVerified: false }), "admin")).toBe(false);
    expect(canAccessArea(actor("CLIENT", { status: "SUSPENDED" }), "client")).toBe(false);
  });

  it("sends each role to its home area", () => {
    expect(homeArea("CLIENT")).toBe("client");
    expect(homeArea("PROVIDER")).toBe("provider");
    expect(homeArea("ADMIN")).toBe("admin");
  });

  it("blocks sign-in for suspended and deactivated accounts", () => {
    expect(canSignIn("ACTIVE")).toBe(true);
    expect(canSignIn("PENDING_VERIFICATION")).toBe(true);
    expect(canSignIn("SUSPENDED")).toBe(false);
    expect(canSignIn("DEACTIVATED")).toBe(false);
  });

  it("lets any client who can sign in request appointments (e-mail confirmation not required for now)", () => {
    expect(BOOKING_REQUIRES_VERIFIED_EMAIL).toBe(false);
    expect(canRequestAppointment(actor("CLIENT"))).toBe(true);
    expect(canRequestAppointment(actor("CLIENT", { emailVerified: false, status: "PENDING_VERIFICATION" }))).toBe(true);
    expect(canRequestAppointment(actor("CLIENT", { status: "SUSPENDED" }))).toBe(false);
    expect(canRequestAppointment(actor("PROVIDER"))).toBe(false);
  });
});

describe("privilege changes", () => {
  const client = { id: "u2", role: "CLIENT" as Role };
  const admin = { id: "u3", role: "ADMIN" as Role };

  it("only a super admin grants or removes staff roles", () => {
    expect(canChangeRole(actor("ADMIN"), client, "ADMIN")).toBe(false);
    expect(canChangeRole(actor("ADMIN"), client, "SUPPORT")).toBe(false);
    expect(canChangeRole(actor("ADMIN"), admin, "CLIENT")).toBe(false);
    expect(canChangeRole(actor("SUPER_ADMIN"), client, "ADMIN")).toBe(true);
    expect(canChangeRole(actor("SUPER_ADMIN"), admin, "CLIENT")).toBe(true);
  });

  it("lets admins move non-staff accounts between client and provider only", () => {
    expect(canChangeRole(actor("ADMIN"), client, "PROVIDER")).toBe(true);
    expect(canChangeRole(actor("SUPPORT"), client, "PROVIDER")).toBe(false);
    expect(canChangeRole(actor("PROVIDER"), client, "PROVIDER")).toBe(false);
    expect(canChangeRole(actor("CLIENT"), client, "ADMIN")).toBe(false);
  });

  it("never lets anyone change their own role, even a super admin", () => {
    const self = actor("SUPER_ADMIN");
    expect(canChangeRole(self, { id: self.id, role: "SUPER_ADMIN" }, "ADMIN")).toBe(false);
    const a = actor("ADMIN");
    expect(canChangeRole(a, { id: a.id, role: "ADMIN" }, "SUPER_ADMIN")).toBe(false);
  });

  it("refuses unverified or suspended actors", () => {
    expect(canChangeRole(actor("SUPER_ADMIN", { emailVerified: false }), client, "ADMIN")).toBe(false);
    expect(canChangeRole(actor("SUPER_ADMIN", { status: "SUSPENDED" }), client, "ADMIN")).toBe(false);
  });

  it("protects staff from suspension by lower ranks", () => {
    expect(canChangeStatus(actor("ADMIN"), client)).toBe(true);
    expect(canChangeStatus(actor("ADMIN"), admin)).toBe(false);
    expect(canChangeStatus(actor("SUPER_ADMIN"), admin)).toBe(true);
    expect(canChangeStatus(actor("SUPPORT"), client)).toBe(false);
  });

  it("never lets a provider verify providers", () => {
    expect(canVerifyProvider(actor("PROVIDER"))).toBe(false);
    expect(canVerifyProvider(actor("SUPPORT"))).toBe(false);
    expect(canVerifyProvider(actor("ADMIN"))).toBe(true);
  });
});

describe("resource ownership", () => {
  it("limits provider resources to their owner", () => {
    expect(canManageProviderResource(actor("PROVIDER", { id: "p1" }), "p1")).toBe(true);
    expect(canManageProviderResource(actor("PROVIDER", { id: "p1" }), "p2")).toBe(false);
    expect(canManageProviderResource(actor("ADMIN", { id: "p1" }), "p1")).toBe(false);
  });

  it("shows a booking to its client, its provider and staff only", () => {
    const booking = { clientId: "c1", providerUserId: "p1" };
    expect(canViewBooking(actor("CLIENT", { id: "c1" }), booking)).toBe(true);
    expect(canViewBooking(actor("CLIENT", { id: "c2" }), booking)).toBe(false);
    expect(canViewBooking(actor("PROVIDER", { id: "p1" }), booking)).toBe(true);
    expect(canViewBooking(actor("PROVIDER", { id: "p2" }), booking)).toBe(false);
    expect(canViewBooking(actor("SUPPORT"), booking)).toBe(true);
    expect(canViewBooking(actor("CLIENT", { id: "c1", status: "SUSPENDED" }), booking)).toBe(false);
  });
});

describe("safeNextPath (open redirects)", () => {
  it.each([
    ["/fr/dashboard/client", "/fr/dashboard/client"],
    ["/fr/profiles/x?y=1", "/fr/profiles/x?y=1"],
    ["//evil.example", null],
    ["https://evil.example", null],
    ["/\\evil.example", null],
    ["javascript:alert(1)", null],
    ["/ar/dashboard/client", null], // other locale
    ["/fr/auth/sign-in", null], // no loop back into auth pages
    ["/admin", null],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input, "fr")).toBe(expected);
  });
});

describe("passwords and tokens", () => {
  it("hashes with scrypt and verifies only the right password", async () => {
    const hash = await hashPassword("Rose garden 2026");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Rose garden 2026", hash)).toBe(true);
    expect(await verifyPassword("rose garden 2026", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("enforces length, letters + digits and no email reuse", () => {
    expect(passwordProblem("short1")).toBe("length");
    expect(passwordProblem("onlyletterslong")).toBe("weak");
    expect(passwordProblem("1234567890")).toBe("weak");
    expect(passwordProblem("amina2026salon", "amina@example.com")).toBe("weak");
    expect(passwordProblem("Jasmin et rose 7", "amina@example.com")).toBeNull();
  });

  it("creates long random tokens and stores only their hash", () => {
    const t = newToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(newToken()).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
});

describe("sign-up validation", () => {
  it("normalises Algerian phone numbers", () => {
    expect(normalizeDzPhone("0550 12 34 56")).toBe("+213550123456");
    expect(normalizeDzPhone("+213 6 61 23 45 67")).toBe("+213661234567");
    expect(normalizeDzPhone("00213-770-12-34-56")).toBe("+213770123456");
    expect(normalizeDzPhone("021 23 45 67")).toBe("+21321234567");
    expect(normalizeDzPhone("12345")).toBeNull();
    expect(normalizeDzPhone("+33612345678")).toBeNull();
  });

  const base = { fullName: "Amina B", email: "AMINA@Example.com", phone: "0550123456", password: "Jasmin et rose 7", terms: "on" };

  it("lower-cases emails and requires the terms", () => {
    const ok = clientSignUpSchema.safeParse(base);
    expect(ok.success && ok.data.email).toBe("amina@example.com");
    expect(clientSignUpSchema.safeParse({ ...base, terms: undefined }).success).toBe(false);
  });

  it("reports password and other field errors together", () => {
    const r = clientSignUpSchema.safeParse({ ...base, phone: "x", password: "short" });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["phone", "password"]));
  });

  it("requires at least one known category for professionals", () => {
    const pro = { ...base, businessName: "Salon A", wilaya: "16", workplaceType: "SALON" };
    expect(providerSignUpSchema.safeParse({ ...pro, categories: [] }).success).toBe(false);
    expect(providerSignUpSchema.safeParse({ ...pro, categories: ["piercing"] }).success).toBe(false);
    expect(providerSignUpSchema.safeParse({ ...pro, categories: ["nails", "botox"] }).success).toBe(true);
  });
});

describe("email templates", () => {
  it("escapes user data and renders Arabic right-to-left", () => {
    const fr = renderEmail("verify-email", "fr", { name: '<script>x</script>', url: "https://a.test/?t=1&u=2" });
    expect(fr.html).not.toContain("<script>x</script>");
    expect(fr.html).toContain("&lt;script&gt;");
    expect(fr.html).toContain("https://a.test/?t=1&amp;u=2");
    expect(fr.text).toContain("https://a.test/?t=1&u=2");
    const ar = renderEmail("reset-password", "ar", { name: "أمينة", url: "https://a.test" });
    expect(ar.html).toContain('dir="rtl"');
    expect(ar.subject).toBe("إعادة تعيين كلمة المرور");
  });
});
