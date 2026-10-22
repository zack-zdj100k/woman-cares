import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Actor, Role } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { SettingsBlocked, getPaymentDetails, getPublisher, setPaymentDetails, setPublisher } from "@/server/services/site-settings";
import { resetDatabase } from "./fixtures";

const PASSWORD = "Jasmin et rose 7";
const RIP = "007 99999 0012345678 12";
const NUMBER = "00799999001234567812";

let owner: Actor;
let colleague: Actor;
let admin: Actor;
let provider: Actor;
let client: Actor;

async function person(role: Role, name: string, verified = true): Promise<Actor> {
  const u = await db.user.create({
    data: { email: `${name}-${randomUUID()}@test.invalid`, fullName: name, passwordHash: await hashPassword(PASSWORD), role, status: "ACTIVE", emailVerifiedAt: verified ? new Date() : null },
  });
  return { id: u.id, role, status: "ACTIVE", emailVerified: verified };
}
const save = (actor: Actor, over: Partial<{ holder: string; rip: string; password: string }> = {}) =>
  setPaymentDetails(actor, { holder: "Nadia Kaci", rip: RIP, password: PASSWORD, ...over });

beforeEach(async () => {
  await resetDatabase();
  await db.platformSetting.deleteMany({ where: { key: { in: ["payment.details", "legal.publisher"] } } });
  owner = await person("SUPER_ADMIN", "Owner");
  colleague = await person("SUPER_ADMIN", "Colleague");
  admin = await person("ADMIN", "Admin");
  provider = await person("PROVIDER", "Provider");
  client = await person("CLIENT", "Client");
});

describe("payment details: who can change them", () => {
  it("only a verified Super Admin", async () => {
    for (const actor of [admin, provider, client, { ...owner, emailVerified: false }]) {
      await expect(save(actor)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.platformSetting.count({ where: { key: "payment.details" } })).toBe(0);
  });

  it("asks for the password again: a session alone cannot redirect the payments", async () => {
    await expect(save(owner, { password: "not my password" })).rejects.toMatchObject({ reason: "password" });
    expect(await db.platformSetting.count({ where: { key: "payment.details" } })).toBe(0);
    expect(await db.auditLog.count({ where: { actorId: owner.id, action: "settings.payment.password_failed" } })).toBe(1);
  });

  it("locks the form after five wrong passwords, even for the right one", async () => {
    for (let i = 0; i < 5; i++) await expect(save(owner, { password: `wrong ${i}` })).rejects.toMatchObject({ reason: "password" });
    await expect(save(owner)).rejects.toMatchObject({ reason: "locked" });
    expect(await db.platformSetting.count({ where: { key: "payment.details" } })).toBe(0);
    // The lock is per person: a colleague is not locked out.
    await expect(save(colleague)).resolves.toBeUndefined();
  });

  it("refuses an invalid name or number without storing anything", async () => {
    await expect(save(owner, { rip: "12ab" })).rejects.toMatchObject({ reason: "rip" });
    await expect(save(owner, { holder: " " })).rejects.toMatchObject({ reason: "holder" });
    expect(await db.platformSetting.count({ where: { key: "payment.details" } })).toBe(0);
  });
});

describe("payment details: the journal and the alerts", () => {
  it("stores a signed value, journals old and new, and alerts every Super Admin", async () => {
    await save(owner);
    const row = (await db.platformSetting.findUniqueOrThrow({ where: { key: "payment.details" } })).value as Record<string, string>;
    expect(row).toMatchObject({ holder: "Nadia Kaci", rip: NUMBER });
    expect(row.sig).toMatch(/^[0-9a-f]{64}$/);

    await save(owner, { holder: "Nadia K.", rip: "00799999009999999912" });
    const entries = await db.auditLog.findMany({ where: { action: "settings.payment.update" }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => e.metadata)).toEqual([
      { from: null, to: { holder: "Nadia Kaci", rip: NUMBER } },
      { from: { holder: "Nadia Kaci", rip: NUMBER }, to: { holder: "Nadia K.", rip: "00799999009999999912" } },
    ]);

    // Both Super Admins hear about each change; nobody else does.
    for (const who of [owner, colleague]) expect(await db.notification.count({ where: { userId: who.id, type: "staff.payment-details" } })).toBe(2);
    for (const who of [admin, provider, client]) expect(await db.notification.count({ where: { userId: who.id, type: "staff.payment-details" } })).toBe(0);
    const emails = await db.outboxEvent.findMany();
    expect(emails.filter((e) => (e.payload as { template: string }).template === "staff-alert")).toHaveLength(4);
  });
});

describe("payment details: who can read them", () => {
  it("professionals and Super Admins see them; nobody else", async () => {
    expect(await getPaymentDetails(provider)).toEqual({ status: "none" });
    await save(owner);
    for (const who of [provider, owner, colleague]) {
      expect(await getPaymentDetails(who)).toMatchObject({ status: "ok", holder: "Nadia Kaci", rip: NUMBER });
    }
    await expect(getPaymentDetails(client)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPaymentDetails(admin)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("payment details: tampering", () => {
  it("hides a value changed straight in the database and alerts once", async () => {
    await save(owner);
    await db.$executeRawUnsafe(`UPDATE "PlatformSetting" SET value = jsonb_set(value, '{rip}', '"00799999009999999912"') WHERE key = 'payment.details'`);

    expect(await getPaymentDetails(provider)).toEqual({ status: "tampered" });
    expect(await getPaymentDetails(provider)).toEqual({ status: "tampered" });
    expect(await getPaymentDetails(owner)).toEqual({ status: "tampered" });

    for (const who of [owner, colleague]) expect(await db.notification.count({ where: { userId: who.id, type: "staff.payment-tampered" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "settings.payment.tampered" } })).toBe(1);
  });

  it("hides a value whose signature was removed or forged, and recovers once saved again", async () => {
    await save(owner);
    await db.$executeRawUnsafe(`UPDATE "PlatformSetting" SET value = value - 'sig' WHERE key = 'payment.details'`);
    expect(await getPaymentDetails(provider)).toEqual({ status: "tampered" });
    await db.$executeRawUnsafe(`UPDATE "PlatformSetting" SET value = jsonb_set(value, '{sig}', '"${"0".repeat(64)}"') WHERE key = 'payment.details'`);
    expect(await getPaymentDetails(provider)).toEqual({ status: "tampered" });

    await save(owner);
    expect(await getPaymentDetails(provider)).toMatchObject({ status: "ok", rip: NUMBER });
  });
});

describe("publisher information", () => {
  const info = { name: "Woman Cares SARL", rc: "16/00-1234567 B 26", nif: "000016123456789", address: "Alger", phone: "0550 12 34 56", email: "contact@example.test" };

  it("is shown once a Super Admin saves it, journalled with old and new", async () => {
    expect(await getPublisher()).toBeNull();
    await setPublisher(owner, info);
    expect(await getPublisher()).toEqual(info);
    await setPublisher(owner, { ...info, phone: "" });
    expect(await getPublisher()).toEqual({ ...info, phone: "" });
    const entries = await db.auditLog.findMany({ where: { action: "settings.publisher.update" }, orderBy: { createdAt: "asc" } });
    expect(entries).toHaveLength(2);
    expect((entries[1].metadata as { from: { phone: string } }).from.phone).toBe("0550 12 34 56");
  });

  it("disappears when every field is cleared", async () => {
    await setPublisher(owner, info);
    await setPublisher(owner, { name: "", rc: "", nif: "", address: "", phone: "", email: "" });
    expect(await getPublisher()).toBeNull();
  });

  it("refuses an invalid e-mail and anyone but a Super Admin", async () => {
    await expect(setPublisher(owner, { ...info, email: "not an email" })).rejects.toBeInstanceOf(SettingsBlocked);
    for (const who of [admin, provider, client]) await expect(setPublisher(who, info)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getPublisher()).toBeNull();
  });
});
