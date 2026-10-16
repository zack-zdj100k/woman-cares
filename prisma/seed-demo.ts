/**
 * LOCAL DEMO DATA. Never run in production.
 *
 * Creates a handful of clearly labelled demo businesses ("Démo · …") so the directories and
 * profile pages can be developed and tested before real professionals join. It creates no
 * reviews, no bookings and no payments: those only ever come from real activity.
 * Demo accounts cannot sign in (their password hash is not a valid hash).
 *
 * Usage: ALLOW_DEMO_SEED=1 npx tsx prisma/seed-demo.ts            (create or refresh)
 *        ALLOW_DEMO_SEED=1 npx tsx prisma/seed-demo.ts --remove   (delete demo data)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "1") {
  console.error("Refusing to run: set ALLOW_DEMO_SEED=1 in a non-production environment.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DEMO_EMAIL_DOMAIN = "demo.woman-cares.invalid";

// Real communes, approximate centroids (the full commune dataset is imported in Phase 5).
const communes = [
  { wilayaCode: 16, nameFr: "Hydra", nameAr: "حيدرة", latitude: 36.743, longitude: 3.032 },
  { wilayaCode: 16, nameFr: "Bab Ezzouar", nameAr: "باب الزوار", latitude: 36.721, longitude: 3.183 },
  { wilayaCode: 16, nameFr: "Chéraga", nameAr: "الشراقة", latitude: 36.766, longitude: 2.958 },
  { wilayaCode: 31, nameFr: "Oran", nameAr: "وهران", latitude: 35.697, longitude: -0.633 },
  { wilayaCode: 25, nameFr: "Constantine", nameAr: "قسنطينة", latitude: 36.365, longitude: 6.615 },
  { wilayaCode: 9, nameFr: "Blida", nameAr: "البليدة", latitude: 36.47, longitude: 2.829 },
];

type ServiceSeed = { name: string; duration: number; min: number; max?: number; description?: string };
type ProfileSeed = {
  category: string;
  headline: string;
  description: string;
  experienceYears: number;
  specialties: string[];
  services: ServiceSeed[];
  frames: number[];
  hygieneNotes?: string;
  productNotes?: string;
  cancellationPolicy?: string;
};
type ProviderSeed = {
  key: string;
  businessName: string;
  commune: string;
  workplaceType: "SALON" | "STUDIO" | "HOME" | "MOBILE";
  visibility: "EXACT" | "APPROXIMATE" | "COMMUNE_ONLY";
  offset: [number, number];
  verified: boolean;
  publicPhone?: string;
  bio: string;
  // weekday 0 = Sunday … 6 = Saturday; [start, end] in minutes
  hours: Record<number, [number, number][]>;
  capacity: number;
  profiles: ProfileSeed[];
};

const H = (h: number, m = 0) => h * 60 + m;
const weekWithBreak = (open: number, close: number, days = [6, 0, 1, 2, 3]) =>
  Object.fromEntries(days.map((d) => [d, [[open, H(13)], [H(14), close]] as [number, number][]]));

const providers: ProviderSeed[] = [
  {
    key: "lina",
    businessName: "Démo · Salon Lina",
    commune: "Hydra",
    workplaceType: "SALON",
    visibility: "EXACT",
    offset: [0.004, -0.003],
    verified: true,
    bio: "Compte de démonstration. Salon fictif utilisé pour développer la plateforme.",
    hours: weekWithBreak(H(9), H(19)),
    capacity: 3,
    profiles: [
      {
        category: "coiffeuses",
        headline: "Coupes, balayages et chignons de mariée",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 9,
        specialties: ["coupe", "balayage", "chignon", "mariee"],
        services: [
          { name: "Coupe et brushing", duration: 60, min: 2500, max: 4000 },
          { name: "Balayage", duration: 180, min: 9000, max: 15000, description: "Diagnostic couleur inclus." },
          { name: "Chignon de mariée", duration: 120, min: 12000 },
        ],
        frames: [2, 1, 3, 4],
        hygieneNotes: "Outils désinfectés entre chaque cliente, serviettes à usage unique.",
        cancellationPolicy: "Annulation gratuite jusqu’à 24 h avant le rendez-vous.",
      },
      {
        category: "nails",
        headline: "Semi-permanent et nail art délicat",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 4,
        specialties: ["manucure", "semi-permanent", "nail-art"],
        services: [
          { name: "Manucure semi-permanent", duration: 60, min: 2000 },
          { name: "Pose gel", duration: 90, min: 3500, max: 5000 },
        ],
        frames: [10, 9, 11, 12],
      },
      {
        category: "extensions-de-cils",
        headline: "Cil à cil naturel et rehaussement",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 3,
        specialties: ["cil-a-cil", "rehaussement"],
        services: [{ name: "Pose cil à cil", duration: 120, min: 6000 }],
        frames: [6, 7],
      },
    ],
  },
  {
    key: "yasmine",
    businessName: "Démo · Institut Yasmine",
    commune: "Oran",
    workplaceType: "SALON",
    visibility: "APPROXIMATE",
    offset: [0.012, 0.009],
    verified: true,
    publicPhone: "+213 000 00 00 00",
    bio: "Compte de démonstration. Institut fictif.",
    hours: weekWithBreak(H(9, 30), H(18, 30), [6, 0, 1, 2, 3, 4]),
    capacity: 2,
    profiles: [
      {
        category: "esthetique",
        headline: "Soins du visage et rituels de peau",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 12,
        specialties: ["soin-visage", "nettoyage-peau", "sourcils"],
        services: [
          { name: "Soin du visage hydratant", duration: 60, min: 4000 },
          { name: "Nettoyage de peau", duration: 75, min: 4500 },
          { name: "Restructuration des sourcils", duration: 30, min: 1200 },
        ],
        frames: [5, 6, 7, 8],
        productNotes: "Gammes professionnelles, liste détaillée sur demande.",
      },
      {
        category: "massage",
        headline: "Massages relaxants en cabine",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 7,
        specialties: ["relaxant", "dos", "pierres-chaudes"],
        services: [
          { name: "Massage relaxant", duration: 60, min: 5000 },
          { name: "Pierres chaudes", duration: 90, min: 7000 },
        ],
        frames: [14, 13, 15, 16],
      },
    ],
  },
  {
    key: "amel",
    businessName: "Démo · Amel Nails Studio",
    commune: "Bab Ezzouar",
    workplaceType: "STUDIO",
    visibility: "COMMUNE_ONLY",
    offset: [0, 0],
    verified: false,
    bio: "Compte de démonstration. Studio fictif.",
    hours: { 6: [[H(10), H(18)]], 0: [[H(10), H(18)]], 1: [[H(10), H(18)]], 3: [[H(12), H(20)]] },
    capacity: 1,
    profiles: [
      {
        category: "nails",
        headline: "Capsules, gel et nail art sur mesure",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 2,
        specialties: ["capsules", "gel", "nail-art", "pedicure"],
        services: [
          { name: "Extensions capsules", duration: 120, min: 4500 },
          { name: "Pédicure", duration: 60, min: 2500 },
        ],
        frames: [11, 12, 9],
      },
    ],
  },
  {
    key: "sara",
    businessName: "Démo · Sara à domicile",
    commune: "Blida",
    workplaceType: "MOBILE",
    visibility: "COMMUNE_ONLY",
    offset: [0, 0],
    verified: false,
    bio: "Compte de démonstration. Activité fictive.",
    hours: { 4: [[H(9), H(17)]], 5: [[H(9), H(13)]], 6: [[H(9), H(17)]] },
    capacity: 1,
    profiles: [
      {
        category: "coiffeuses",
        headline: "Brushing et coiffures de fête, je me déplace",
        description: "Profil de démonstration. Les textes, prix et horaires sont fictifs.",
        experienceYears: 5,
        specialties: ["brushing", "chignon"],
        services: [{ name: "Brushing", duration: 45, min: 1500 }],
        frames: [3, 4],
      },
    ],
  },
];

async function remove() {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } }, select: { id: true } });
  const providerIds = (await db.providerAccount.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } })).map((p) => p.id);
  const profileIds = (await db.providerServiceProfile.findMany({ where: { providerId: { in: providerIds } }, select: { id: true } })).map((p) => p.id);
  await db.$transaction([
    db.profileViewEvent.deleteMany({ where: { profileId: { in: profileIds } } }),
    db.portfolioMedia.deleteMany({ where: { profileId: { in: profileIds } } }),
    db.workingSchedule.deleteMany({ where: { profileId: { in: profileIds } } }),
    db.scheduleException.deleteMany({ where: { profileId: { in: profileIds } } }),
    db.providerService.deleteMany({ where: { profileId: { in: profileIds } } }),
    db.providerServiceProfile.deleteMany({ where: { id: { in: profileIds } } }),
    db.providerAccount.deleteMany({ where: { id: { in: providerIds } } }),
    db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } }),
  ]);
  console.log(`Removed ${providerIds.length} demo providers.`);
}

async function main() {
  await remove();
  if (process.argv.includes("--remove")) return;

  const communeIds = new Map<string, { id: number; lat: number; lng: number; wilayaCode: number }>();
  for (const c of communes) {
    const row = await db.commune.upsert({
      where: { wilayaCode_nameFr: { wilayaCode: c.wilayaCode, nameFr: c.nameFr } },
      update: {},
      create: c,
    });
    communeIds.set(c.nameFr, { id: row.id, lat: c.latitude, lng: c.longitude, wilayaCode: c.wilayaCode });
  }
  const categories = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));

  for (const p of providers) {
    const commune = communeIds.get(p.commune)!;
    const user = await db.user.create({
      data: {
        email: `${p.key}@${DEMO_EMAIL_DOMAIN}`,
        fullName: p.businessName,
        passwordHash: "!demo-account-cannot-sign-in",
        role: "PROVIDER",
        status: "ACTIVE",
      },
    });
    const account = await db.providerAccount.create({
      data: {
        userId: user.id,
        businessName: p.businessName,
        slug: `demo-${p.key}`,
        status: "APPROVED",
        workplaceType: p.workplaceType,
        bio: p.bio,
        publicPhone: p.publicPhone,
        wilayaCode: commune.wilayaCode,
        communeId: commune.id,
        latitude: commune.lat + p.offset[0],
        longitude: commune.lng + p.offset[1],
        locationVisibility: p.visibility,
        verifiedAt: p.verified ? new Date() : null,
      },
    });
    for (const [i, prof] of p.profiles.entries()) {
      const profile = await db.providerServiceProfile.create({
        data: {
          providerId: account.id,
          categoryId: categories.get(prof.category)!,
          slug: `demo-${p.key}-${prof.category}`,
          headline: prof.headline,
          description: prof.description,
          experienceYears: prof.experienceYears,
          startingPrice: Math.min(...prof.services.map((s) => s.min)),
          specialties: prof.specialties,
          hygieneNotes: prof.hygieneNotes,
          productNotes: prof.productNotes,
          cancellationPolicy: prof.cancellationPolicy,
          status: "PUBLISHED",
          publishedAt: new Date(Date.now() - i * 3_600_000),
        },
      });
      await db.providerService.createMany({
        data: prof.services.map((s, order) => ({
          profileId: profile.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.duration,
          priceMin: s.min,
          priceMax: s.max,
          sortOrder: order,
        })),
      });
      await db.portfolioMedia.createMany({
        data: prof.frames.map((f, order) => ({
          profileId: profile.id,
          type: "IMAGE" as const,
          storageKey: `demo/frame-${f}.jpg`,
          mimeType: "image/jpeg",
          sortOrder: order,
          isCardImage: order === 0,
          isCover: order === 0,
          altText: `${prof.headline} (démo)`,
        })),
      });
      await db.workingSchedule.createMany({
        data: Object.entries(p.hours).flatMap(([weekday, ranges]) =>
          ranges.map(([startMinute, endMinute]) => ({ profileId: profile.id, weekday: Number(weekday), startMinute, endMinute, capacity: p.capacity })),
        ),
      });
    }
  }
  console.log(`Seeded ${providers.length} demo providers (${providers.reduce((n, p) => n + p.profiles.length, 0)} profiles). No reviews or bookings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
