/**
 * Fills the TEST database with one account per role, a published professional with a service, a
 * schedule and one booking, and a live session for each account. Prints a Postman environment
 * file (session cookies and ids) to the path given as the first argument.
 *
 * Usage: TEST_DATABASE_URL=... npx tsx tests/postman/seed-audit.ts <out.json>
 * Refuses to run unless the database name contains "test".
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashToken, newToken } from "../../src/lib/auth/tokens";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/test/i.test(url)) throw new Error("TEST_DATABASE_URL must point to a test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.replace(/\?schema=public$/, ""), options: "-c TimeZone=UTC" }) });

const ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "PROVIDER", "CLIENT"] as const;

async function main() {
  await db.$executeRawUnsafe(`TRUNCATE "ProfileViewEvent", "Review", "BookingPayment", "BookingReferenceMedia", "BookingStatusHistory", "Booking",
    "PortfolioMedia", "WorkingSchedule", "ScheduleException", "ProviderService", "Favorite", "SubscriptionItem",
    "ProviderServiceProfile", "ProviderCategoryRequest", "ProviderCredential", "ProviderAccount", "SupportRequest",
    "Session", "VerificationToken", "Notification", "AuditLog", "EmailDeliveryLog", "OutboxEvent", "NotificationPreference", "User" RESTART IDENTITY CASCADE`);

  const env: Record<string, string> = {};
  const users: Record<string, string> = {};
  for (const role of ROLES) {
    const u = await db.user.create({
      data: { email: `${role.toLowerCase()}@audit.test`, fullName: `Audit ${role}`, passwordHash: "!audit", role, status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    users[role] = u.id;
    const token = newToken();
    await db.session.create({ data: { userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000), userAgent: "postman-audit", ipHash: "audit" } });
    env[`cookie_${role}`] = `wc_session=${token}`;
  }

  const provider = await db.providerAccount.create({
    data: { userId: users.PROVIDER, businessName: "Atelier Audit", slug: "atelier-audit", status: "APPROVED", wilayaCode: 16, locationVisibility: "APPROXIMATE", verifiedAt: new Date() },
  });
  const category = await db.category.findUniqueOrThrow({ where: { slug: "coiffeuses" } });
  const profile = await db.providerServiceProfile.create({
    data: { providerId: provider.id, categoryId: category.id, slug: "audit-coiffeuse", headline: "Profil de test", status: "PUBLISHED", billingVisible: true, startingPrice: 2000, specialties: [], publishedAt: new Date() },
  });
  const service = await db.providerService.create({ data: { profileId: profile.id, name: "Brushing", durationMinutes: 60, priceMin: 2000, sortOrder: 0 } });
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) await db.workingSchedule.create({ data: { profileId: profile.id, weekday, startMinute: 540, endMinute: 1080 } });

  const startAt = new Date(Date.now() + 3 * 86_400_000);
  startAt.setUTCHours(10, 0, 0, 0);
  const booking = await db.booking.create({
    data: {
      reference: "AUDIT-1", clientId: users.CLIENT, providerId: provider.id, profileId: profile.id, serviceId: service.id,
      startAt, endAt: new Date(startAt.getTime() + 3_600_000), requestedStartAt: startAt, status: "PENDING",
      serviceNameSnap: "Brushing", durationMinSnap: 60, priceMinSnap: 2000, pendingExpiresAt: new Date(Date.now() + 86_400_000),
    },
  });

  Object.assign(env, {
    profileSlug: profile.slug, profileId: profile.id, serviceId: service.id, providerId: provider.id, providerSlug: provider.slug, bookingId: booking.id,
    clientUserId: users.CLIENT, providerUserId: users.PROVIDER,
  });
  const out = process.argv[2];
  const body = { name: "woman-cares-audit", values: Object.entries(env).map(([key, value]) => ({ key, value, enabled: true })) };
  if (out) writeFileSync(out, JSON.stringify(body, null, 2));
  console.log(`Seeded ${ROLES.length} accounts, 1 professional, 1 booking.`);
}

main().finally(() => db.$disconnect());
