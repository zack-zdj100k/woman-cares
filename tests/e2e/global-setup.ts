import { execSync } from "node:child_process";
import { testDb } from "./db";

/** Fresh schema + reference data, and no leftover users from previous runs. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "ignore" });
  const db = testDb();
  await db.connect();
  await db.query(`TRUNCATE "ProfileViewEvent", "Review", "Booking", "PortfolioMedia", "WorkingSchedule", "ProviderService",
    "ProviderServiceProfile", "ProviderCategoryRequest", "ProviderAccount", "SupportRequest", "Session", "VerificationToken",
    "AuditLog", "EmailDeliveryLog", "OutboxEvent", "NotificationPreference", "User" RESTART IDENTITY CASCADE`);
  await db.end();
}
