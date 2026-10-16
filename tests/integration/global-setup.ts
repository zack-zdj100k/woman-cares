import { execSync } from "node:child_process";

/** Applies migrations and reference data to TEST_DATABASE_URL before the integration suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/test/i.test(url)) throw new Error("TEST_DATABASE_URL must be set and point to a test database.");
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "ignore" });
}
