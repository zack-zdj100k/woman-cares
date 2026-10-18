/**
 * Creates the first Super Admin. There is no default administrator and no shared password.
 *
 *   npm run admin:create -- --email owner@example.com --name "Prénom Nom"
 *
 * The password is read from SUPER_ADMIN_PASSWORD or asked interactively (input hidden).
 * Use --promote to turn an existing, verified account into a Super Admin instead.
 * Every run is written to the audit log.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, passwordProblem } from "../src/lib/auth/password";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function askHidden(question: string) {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(question);
  muted = true;
  const answer = await new Promise<string>((resolve) => rl.question("", resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const promote = process.argv.includes("--promote");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is required");

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, options: "-c TimeZone=UTC" }) });
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && !promote) throw new Error("An account with this email exists. Re-run with --promote to make it Super Admin.");
    if (existing) {
      if (!existing.emailVerifiedAt) throw new Error("Verify this account's email before promoting it.");
      await db.$transaction([
        db.user.update({ where: { id: existing.id }, data: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
        db.session.deleteMany({ where: { userId: existing.id } }),
        db.auditLog.create({ data: { action: "superadmin.bootstrap.promote", entityType: "User", entityId: existing.id, metadata: { from: existing.role } } }),
      ]);
      console.log(`Promoted ${email} to SUPER_ADMIN. Existing sessions were signed out.`);
      return;
    }

    if (!name || name.length < 2) throw new Error("--name is required for a new account");
    const password = process.env.SUPER_ADMIN_PASSWORD ?? (await askHidden("Password (12+ characters): "));
    const problem = passwordProblem(password, email);
    if (problem || password.length < 12) throw new Error("Password too weak: use 12+ characters with letters and digits.");
    if (!process.env.SUPER_ADMIN_PASSWORD) {
      const again = await askHidden("Repeat password: ");
      if (again !== password) throw new Error("Passwords do not match.");
    }
    const user = await db.user.create({
      data: {
        email,
        fullName: name,
        passwordHash: await hashPassword(password),
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        preferences: { create: {} },
      },
    });
    await db.auditLog.create({ data: { action: "superadmin.bootstrap.create", entityType: "User", entityId: user.id } });
    console.log(`Created SUPER_ADMIN ${email}. Sign in at /fr/auth/sign-in.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
