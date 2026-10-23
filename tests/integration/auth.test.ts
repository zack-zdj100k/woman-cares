import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { userFromSessionToken } from "@/lib/auth/session";
import { clientSignUpSchema, providerSignUpSchema } from "@/lib/validation/auth";
import {
  LOCK_MS,
  authenticate,
  claimFirstSignIn,
  requestPasswordReset,
  resetPassword,
  signUpClient,
  signUpProvider,
  verifyEmail,
} from "@/server/services/auth";
import { deliverPendingEmails } from "@/server/services/outbox";
import { ForbiddenError, changeUserRole, setUserSuspended } from "@/server/services/admin-users";
import type { Actor } from "@/server/policies/roles";
import { resetDatabase } from "./fixtures";

const PASSWORD = "Jasmin et rose 7";
const client = (email = "amina@test.invalid") =>
  clientSignUpSchema.parse({ fullName: "Amina Benali", email, phone: "0550123456", password: PASSWORD, terms: "on" });

/** Pulls the raw token out of the newest queued email of a template (as the user would from the link). */
async function tokenFromOutbox(template: string) {
  const events = await db.outboxEvent.findMany({ orderBy: { createdAt: "desc" } });
  const event = events.find((e) => (e.payload as { template: string }).template === template);
  const url = (event!.payload as { data: { url: string } }).data.url;
  return new URL(url).searchParams.get("token")!;
}

async function createSession(userId: string, token: string, expiresAt = new Date(Date.now() + 3_600_000)) {
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("sign-up", () => {
  it("creates a pending client with a verification email queued in the same transaction", async () => {
    const result = await signUpClient(client(), "fr");
    expect(result.status).toBe("created");
    const user = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    expect(user.role).toBe("CLIENT");
    expect(user.status).toBe("PENDING_VERIFICATION");
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.phone).toBe("+213550123456");
    expect(await db.verificationToken.count({ where: { userId: user.id, purpose: "EMAIL_VERIFICATION" } })).toBe(1);
    expect(await db.outboxEvent.count()).toBe(1);
  });

  it("answers duplicates exactly like new sign-ups and notifies the real owner", async () => {
    await signUpClient(client(), "fr");
    const again = await signUpClient({ ...client(), fullName: "Someone Else" }, "fr");
    expect(again.status).toBe("duplicate");
    expect(await db.user.count()).toBe(1);
    const templates = (await db.outboxEvent.findMany()).map((e) => (e.payload as { template: string }).template);
    expect(templates).toEqual(expect.arrayContaining(["verify-email", "account-exists"]));
  });

  it("gives a professional one account with a draft profile per category and a pending request for Botox", async () => {
    const input = providerSignUpSchema.parse({
      fullName: "Lina K",
      businessName: "Salon Lïna",
      email: "lina@test.invalid",
      phone: "0661234567",
      password: PASSWORD,
      wilaya: "16",
      workplaceType: "SALON",
      categories: ["coiffeuses", "nails", "botox"],
      terms: "on",
    });
    expect((await signUpProvider(input, "ar")).status).toBe("created");
    const account = await db.providerAccount.findFirstOrThrow({
      include: { profiles: { include: { category: true } }, categoryRequests: { include: { category: true } }, user: true },
    });
    expect(account.user.role).toBe("PROVIDER");
    expect(account.status).toBe("ONBOARDING");
    expect(account.slug).toBe("salon-lina");
    expect(account.profiles.map((p) => [p.category.slug, p.status]).sort()).toEqual([
      ["coiffeuses", "DRAFT"],
      ["nails", "DRAFT"],
    ]);
    expect(account.categoryRequests.map((r) => [r.category.slug, r.status])).toEqual([["botox", "PENDING"]]);
    expect(await db.providerAccount.count()).toBe(1); // one identity, not one account per category
  });
});

describe("sign-in", () => {
  beforeEach(async () => {
    await signUpClient(client(), "fr");
  });

  it("accepts the right password and rejects others without saying which part was wrong", async () => {
    expect(await authenticate("AMINA@test.invalid", PASSWORD)).toMatchObject({ ok: true });
    expect(await authenticate("amina@test.invalid", "wrong password 1")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate("nobody@test.invalid", PASSWORD)).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks the account for 15 minutes after 5 failures, even for the right password", async () => {
    const now = new Date();
    for (let i = 0; i < 4; i++) expect((await authenticate("amina@test.invalid", "wrong", now)).ok).toBe(false);
    expect(await authenticate("amina@test.invalid", "wrong", now)).toEqual({ ok: false, reason: "locked" });
    expect(await authenticate("amina@test.invalid", PASSWORD, now)).toEqual({ ok: false, reason: "locked" });
    const later = new Date(now.getTime() + LOCK_MS + 1000);
    expect(await authenticate("amina@test.invalid", PASSWORD, later)).toMatchObject({ ok: true });
  });

  it("refuses suspended accounts", async () => {
    await db.user.update({ where: { email: "amina@test.invalid" }, data: { status: "SUSPENDED" } });
    expect(await authenticate("amina@test.invalid", PASSWORD)).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("sessions", () => {
  it("resolves valid sessions and rejects expired, unknown and suspended ones", async () => {
    await signUpClient(client(), "fr");
    const user = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    await createSession(user.id, "valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    await createSession(user.id, "expired-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", new Date(Date.now() - 1000));
    expect((await userFromSessionToken("valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))?.id).toBe(user.id);
    expect(await userFromSessionToken("expired-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    expect(await userFromSessionToken("unknown")).toBeNull();
    expect(await userFromSessionToken(undefined)).toBeNull();
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    expect(await userFromSessionToken("valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
  });
});

describe("email verification", () => {
  it("activates the account once; the link cannot be reused", async () => {
    await signUpClient(client(), "fr");
    const token = await tokenFromOutbox("verify-email");
    expect(await verifyEmail(token)).toMatchObject({ ok: true });
    const user = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await verifyEmail(token)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects expired links and never re-activates a suspended account", async () => {
    await signUpClient(client(), "fr");
    const token = await tokenFromOutbox("verify-email");
    expect(await verifyEmail(token, new Date(Date.now() + 25 * 3_600_000))).toEqual({ ok: false, reason: "expired" });

    await signUpClient(client("nour@test.invalid"), "fr");
    const token2 = await tokenFromOutbox("verify-email");
    await db.user.update({ where: { email: "nour@test.invalid" }, data: { status: "SUSPENDED" } });
    expect((await verifyEmail(token2)).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { email: "nour@test.invalid" } })).status).toBe("SUSPENDED");
  });
});

describe("telling the staff about a new client", () => {
  async function team() {
    const make = (role: Actor["role"], email: string) => db.user.create({ data: { email, fullName: role, passwordHash: "x", role, status: "ACTIVE", emailVerifiedAt: new Date() } });
    return { owner: await make("SUPER_ADMIN", "owner@test.invalid"), admin: await make("ADMIN", "admin@test.invalid"), support: await make("SUPPORT", "support@test.invalid") };
  }
  const alerts = (userId: string) => db.notification.count({ where: { userId, type: "staff.client" } });
  const staffEmails = async () => (await db.outboxEvent.findMany()).map((e) => e.payload as { template: string; to: string; data: { kind?: string } }).filter((p) => p.template === "staff-alert" && p.data.kind === "client");

  it("alerts the Super Admins and Admins in the app, and the Super Admins by e-mail, once her address is confirmed", async () => {
    const { owner, admin, support } = await team();
    await signUpClient(client(), "fr");
    expect(await alerts(owner.id)).toBe(0); // signing up alone does not alert anyone
    expect(await staffEmails()).toHaveLength(0);

    await verifyEmail(await tokenFromOutbox("verify-email"));
    expect(await alerts(owner.id)).toBe(1);
    expect(await alerts(admin.id)).toBe(1);
    expect(await alerts(support.id)).toBe(0);
    expect((await staffEmails()).map((e) => e.to)).toEqual(["owner@test.invalid"]);
    const note = await db.notification.findFirstOrThrow({ where: { userId: owner.id, type: "staff.client" } });
    expect(note.title).toContain("Amina Benali");
  });

  it("does not alert twice for the same client, nor for a professional or a manual confirmation", async () => {
    const { owner } = await team();
    await signUpClient(client(), "fr");
    const token = await tokenFromOutbox("verify-email");
    await verifyEmail(token);
    await verifyEmail(token); // the link is used up
    expect(await alerts(owner.id)).toBe(1);

    await signUpProvider(
      providerSignUpSchema.parse({ fullName: "Lina K", businessName: "Salon Lina", email: "lina@test.invalid", phone: "0661234567", password: PASSWORD, wilaya: "16", workplaceType: "SALON", categories: ["nails"], terms: "on" }),
      "fr",
    );
    await verifyEmail(await tokenFromOutbox("verify-email"));
    expect(await alerts(owner.id)).toBe(1); // the professional alerted at sign-up, with another kind
    expect(await db.notification.count({ where: { userId: owner.id, type: "staff.provider" } })).toBe(1);
  });
});

describe("signing in right after the first confirmation", () => {
  async function confirmed(role: Actor["role"], email: string, over: Record<string, unknown> = {}) {
    const u = await db.user.create({ data: { email, fullName: role, passwordHash: "x", role, status: "ACTIVE", emailVerifiedAt: new Date(), ...over } });
    return u.id;
  }

  it("opens her space once, for a client or a professional who has never signed in", async () => {
    const clientId = await confirmed("CLIENT", "c@test.invalid");
    const proId = await confirmed("PROVIDER", "p@test.invalid");
    expect(await claimFirstSignIn(clientId)).toBe("CLIENT");
    expect(await claimFirstSignIn(proId)).toBe("PROVIDER");
    expect((await db.user.findUniqueOrThrow({ where: { id: clientId } })).lastLoginAt).not.toBeNull();
    // A second click on the same link, or any later confirmation, must not open a session again.
    expect(await claimFirstSignIn(clientId)).toBeNull();
  });

  it("is never offered to staff, who always use their password", async () => {
    for (const role of ["SUPPORT", "ADMIN", "SUPER_ADMIN"] as const) {
      expect(await claimFirstSignIn(await confirmed(role, `${role.toLowerCase()}@test.invalid`))).toBeNull();
    }
  });

  it("is not offered to an unconfirmed, suspended or already signed-in account", async () => {
    expect(await claimFirstSignIn(await confirmed("CLIENT", "u@test.invalid", { emailVerifiedAt: null }))).toBeNull();
    expect(await claimFirstSignIn(await confirmed("CLIENT", "s@test.invalid", { status: "SUSPENDED" }))).toBeNull();
    expect(await claimFirstSignIn(await confirmed("CLIENT", "a@test.invalid", { lastLoginAt: new Date() }))).toBeNull();
  });

  it("lets only one of two simultaneous clicks open a session", async () => {
    const id = await confirmed("CLIENT", "race@test.invalid");
    const results = await Promise.all([claimFirstSignIn(id), claimFirstSignIn(id), claimFirstSignIn(id)]);
    expect(results.filter((r) => r === "CLIENT")).toHaveLength(1);
  });

  it("follows a real confirmation: a fresh sign-up is eligible once its link is used", async () => {
    await signUpClient(client(), "fr");
    const user = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    expect(await claimFirstSignIn(user.id)).toBeNull(); // not confirmed yet
    const result = await verifyEmail(await tokenFromOutbox("verify-email"));
    expect(result).toMatchObject({ ok: true });
    expect(await claimFirstSignIn(user.id)).toBe("CLIENT");
  });
});

describe("password reset", () => {
  it("does nothing visible for unknown emails", async () => {
    await requestPasswordReset("ghost@test.invalid", "fr");
    expect(await db.outboxEvent.count()).toBe(0);
  });

  it("changes the password once, signs out everywhere and sends a security notice", async () => {
    await signUpClient(client(), "fr");
    const user = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    await createSession(user.id, "session-before-reset-aaaaaaaaaaaaaaaaaaaaaaaaa");
    await requestPasswordReset("amina@test.invalid", "fr");
    const token = await tokenFromOutbox("reset-password");

    expect(await resetPassword(token, "short", "fr")).toEqual({ ok: false, reason: "length" });
    expect(await resetPassword(token, "Nouveau jardin 9", "fr")).toEqual({ ok: true });
    expect(await resetPassword(token, "Encore autre 10", "fr")).toEqual({ ok: false, reason: "invalid" });

    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await authenticate("amina@test.invalid", PASSWORD)).ok).toBe(false);
    expect((await authenticate("amina@test.invalid", "Nouveau jardin 9")).ok).toBe(true);
    const templates = (await db.outboxEvent.findMany()).map((e) => (e.payload as { template: string }).template);
    expect(templates).toContain("password-changed");
  });

  it("invalidates an older reset link when a new one is requested", async () => {
    await signUpClient(client(), "fr");
    await requestPasswordReset("amina@test.invalid", "fr");
    const first = await tokenFromOutbox("reset-password");
    await new Promise((r) => setTimeout(r, 5));
    await requestPasswordReset("amina@test.invalid", "fr");
    expect(await resetPassword(first, "Nouveau jardin 9", "fr")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("email outbox", () => {
  it("delivers queued emails once and records them", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    await signUpClient(client(), "fr");
    expect(await deliverPendingEmails()).toMatchObject({ sent: 1 });
    expect(await deliverPendingEmails()).toMatchObject({ processed: 0, sent: 0 });
    const log = await db.emailDeliveryLog.findFirstOrThrow();
    expect(log.status).toBe("SENT");
    expect((await db.outboxEvent.findFirstOrThrow()).status).toBe("DONE");
  });

  it("keeps the account intact and retries later when sending fails", async () => {
    const transport = await import("@/lib/email/transport");
    const spy = vi.spyOn(transport, "sendRaw").mockRejectedValue(new Error("SMTP down"));
    await signUpClient(client(), "fr");
    const result = await deliverPendingEmails();
    expect(result.sent).toBe(0);
    const event = await db.outboxEvent.findFirstOrThrow();
    expect(event.status).toBe("PENDING");
    expect(event.attempts).toBe(1);
    expect(event.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(event.lastError).toContain("SMTP down");
    expect(await db.user.count({ where: { email: "amina@test.invalid" } })).toBe(1);
    spy.mockRestore();
  });
});

describe("role and status changes (authorization)", () => {
  async function staff(role: Actor["role"], email: string): Promise<Actor> {
    const u = await db.user.create({
      data: { email, fullName: role, passwordHash: "x", role, status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    return { id: u.id, role, status: "ACTIVE", emailVerified: true };
  }

  it("lets only a super admin grant ADMIN, audits it and revokes the target's sessions", async () => {
    await signUpClient(client(), "fr");
    const target = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    await createSession(target.id, "target-session-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const admin = await staff("ADMIN", "admin@test.invalid");
    const superAdmin = await staff("SUPER_ADMIN", "super@test.invalid");

    await expect(changeUserRole(admin, target.id, "ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("CLIENT");
    expect(await db.auditLog.count()).toBe(0);

    await changeUserRole(superAdmin, target.id, "ADMIN");
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("ADMIN");
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    const audit = await db.auditLog.findFirstOrThrow();
    expect(audit).toMatchObject({ actorId: superAdmin.id, action: "user.role.change", entityId: target.id });
  });

  it("refuses unknown targets with the same error as forbidden ones", async () => {
    const superAdmin = await staff("SUPER_ADMIN", "super@test.invalid");
    await expect(changeUserRole(superAdmin, "00000000-0000-0000-0000-000000000000", "ADMIN")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an admin suspend a client (signed out everywhere) but not another admin", async () => {
    await signUpClient(client(), "fr");
    const target = await db.user.findUniqueOrThrow({ where: { email: "amina@test.invalid" } });
    await createSession(target.id, "target-session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    const admin = await staff("ADMIN", "admin@test.invalid");
    const otherAdmin = await staff("ADMIN", "admin2@test.invalid");

    await setUserSuspended(admin, target.id, true, "Signalements répétés");
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("SUSPENDED");
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);
    await expect(setUserSuspended(admin, otherAdmin.id, true, "x")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
