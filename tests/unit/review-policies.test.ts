import { describe, expect, it } from "vitest";
import { canPublishProfile, canReview, canViewModeration, type Actor, type Role } from "@/server/policies/roles";

const actor = (role: Role, o: Partial<Actor> = {}): Actor => ({ id: "u", role, status: "ACTIVE", emailVerified: true, ...o });

describe("review queue policies", () => {
  it("lets verified staff read the queue, never clients or providers", () => {
    expect(canViewModeration(actor("SUPPORT"))).toBe(true);
    expect(canViewModeration(actor("ADMIN"))).toBe(true);
    expect(canViewModeration(actor("SUPER_ADMIN"))).toBe(true);
    expect(canViewModeration(actor("PROVIDER"))).toBe(false);
    expect(canViewModeration(actor("CLIENT"))).toBe(false);
    expect(canViewModeration(actor("ADMIN", { emailVerified: false }))).toBe(false);
    expect(canViewModeration(actor("ADMIN", { status: "SUSPENDED" }))).toBe(false);
  });

  it("limits decisions and credential files to ADMIN and above", () => {
    expect(canReview(actor("SUPPORT"))).toBe(false);
    expect(canReview(actor("ADMIN"))).toBe(true);
    expect(canReview(actor("SUPER_ADMIN"))).toBe(true);
    expect(canReview(actor("PROVIDER"))).toBe(false);
    expect(canReview(actor("ADMIN", { emailVerified: false }))).toBe(false);
  });

  it("publishes only profiles that are under review", () => {
    expect(canPublishProfile(actor("ADMIN"), "PENDING_REVIEW")).toBe(true);
    expect(canPublishProfile(actor("ADMIN"), "DRAFT")).toBe(false);
    expect(canPublishProfile(actor("ADMIN"), "SUSPENDED")).toBe(false);
    expect(canPublishProfile(actor("PROVIDER"), "PENDING_REVIEW")).toBe(false);
    expect(canPublishProfile(actor("SUPPORT"), "PENDING_REVIEW")).toBe(false);
  });
});
