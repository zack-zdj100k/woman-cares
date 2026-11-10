import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The pg driver treats sslmode=require/prefer/verify-ca as verify-full today and warns that its next
 * major version will weaken them. Say verify-full ourselves: same behaviour, no warning, and no
 * silent downgrade later. Local databases without sslmode are left alone.
 */
export function pinSslMode(url: string) {
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/, "$1verify-full");
}

function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set. Copy .env.example to .env (see README).");
  const connectionString = pinSslMode(raw);
  // Every session runs in UTC. With another server time zone (Africa/Algiers on our machines), the
  // driver writes and reads timestamptz values without their offset and every instant drifts by an hour.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}

/** One client per process; reused across hot reloads in development. */
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
