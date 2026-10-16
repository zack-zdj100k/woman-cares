import { db } from "@/lib/db";

/** Empties every non-reference table in the TEST database. */
export async function resetDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/test/i.test(url)) throw new Error("Refusing to reset a database whose URL does not look like a test database.");
  await db.$executeRawUnsafe(`
    TRUNCATE "ProfileViewEvent", "Review", "BookingPayment", "BookingReferenceMedia", "BookingStatusHistory", "Booking",
      "PortfolioMedia", "WorkingSchedule", "ScheduleException", "ProviderService", "Favorite", "SubscriptionItem",
      "ProviderServiceProfile", "ProviderCategoryRequest", "ProviderCredential", "ProviderAccount", "SupportRequest",
      "Session", "VerificationToken", "Notification", "AuditLog", "EmailDeliveryLog", "OutboxEvent", "NotificationPreference", "User", "Commune" RESTART IDENTITY CASCADE`);
}

let n = 0;
type ProviderOpts = {
  name: string;
  wilayaCode?: number;
  commune?: { nameFr: string; lat: number; lng: number };
  exact?: { lat: number; lng: number };
  visibility?: "EXACT" | "APPROXIMATE" | "COMMUNE_ONLY";
  status?: "APPROVED" | "PENDING_REVIEW" | "SUSPENDED";
  verified?: boolean;
};

export async function createProvider(o: ProviderOpts) {
  n += 1;
  const user = await db.user.create({
    data: { email: `p${n}@test.invalid`, fullName: o.name, passwordHash: "x", role: "PROVIDER", status: "ACTIVE" },
  });
  const wilayaCode = o.wilayaCode ?? 16;
  const commune = o.commune
    ? await db.commune.create({
        data: { wilayaCode, nameFr: o.commune.nameFr, nameAr: o.commune.nameFr, latitude: o.commune.lat, longitude: o.commune.lng },
      })
    : null;
  return db.providerAccount.create({
    data: {
      userId: user.id,
      businessName: o.name,
      slug: `p-${n}`,
      status: o.status ?? "APPROVED",
      wilayaCode,
      communeId: commune?.id,
      latitude: o.exact?.lat,
      longitude: o.exact?.lng,
      locationVisibility: o.visibility ?? "APPROXIMATE",
      verifiedAt: o.verified ? new Date() : null,
      addressLine: "12 rue privée",
    },
  });
}

export async function createProfile(
  providerId: string,
  category: string,
  o: {
    slug: string;
    status?: "PUBLISHED" | "DRAFT" | "SUSPENDED";
    billingVisible?: boolean;
    startingPrice?: number;
    experienceYears?: number;
    specialties?: string[];
    services?: string[];
    weekdays?: number[];
    headline?: string;
  },
) {
  const cat = await db.category.findUniqueOrThrow({ where: { slug: category } });
  const profile = await db.providerServiceProfile.create({
    data: {
      providerId,
      categoryId: cat.id,
      slug: o.slug,
      headline: o.headline ?? `Headline ${o.slug}`,
      status: o.status ?? "PUBLISHED",
      billingVisible: o.billingVisible ?? true,
      startingPrice: o.startingPrice,
      experienceYears: o.experienceYears,
      specialties: o.specialties ?? [],
      publishedAt: new Date(),
    },
  });
  for (const [i, name] of (o.services ?? ["Service"]).entries()) {
    await db.providerService.create({ data: { profileId: profile.id, name, durationMinutes: 60, priceMin: o.startingPrice ?? 1000, sortOrder: i } });
  }
  for (const weekday of o.weekdays ?? []) {
    await db.workingSchedule.create({ data: { profileId: profile.id, weekday, startMinute: 540, endMinute: 1080 } });
  }
  return profile;
}

/** A genuine review requires a completed booking by a client. */
export async function createCompletedBookingWithReview(profileId: string, rating: number) {
  n += 1;
  const profile = await db.providerServiceProfile.findUniqueOrThrow({ where: { id: profileId }, include: { services: true } });
  const client = await db.user.create({ data: { email: `c${n}@test.invalid`, fullName: `Client Number${n}`, passwordHash: "x" } });
  const start = new Date("2026-09-01T09:00:00Z");
  const booking = await db.booking.create({
    data: {
      reference: `T-${n}`,
      clientId: client.id,
      providerId: profile.providerId,
      profileId,
      serviceId: profile.services[0].id,
      startAt: start,
      endAt: new Date(start.getTime() + 3_600_000),
      requestedStartAt: start,
      status: "COMPLETED",
      serviceNameSnap: profile.services[0].name,
      durationMinSnap: 60,
      priceMinSnap: profile.services[0].priceMin,
    },
  });
  return db.review.create({ data: { bookingId: booking.id, clientId: client.id, profileId, rating, comment: "Très bien" } });
}
