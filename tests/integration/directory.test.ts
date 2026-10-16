import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { searchDirectory } from "@/server/services/directory";
import { getPublicProfile, getPublicProvider } from "@/server/services/profiles";
import { recordProfileView } from "@/server/services/analytics";
import { parseDirectoryQuery } from "@/lib/validation/directory";
import { createCompletedBookingWithReview, createProfile, createProvider, resetDatabase } from "./fixtures";

const q = (raw: Record<string, string> = {}) => parseDirectoryQuery(raw);
const slugs = (r: { cards: { slug: string }[] }) => r.cards.map((c) => c.slug).sort();

beforeAll(async () => {
  await resetDatabase();
  // Algiers: Hydra (exact location shown), Bab Ezzouar (commune only)
  const near = await createProvider({
    name: "Salon Proche",
    commune: { nameFr: "Hydra", lat: 36.743, lng: 3.032 },
    exact: { lat: 36.747, lng: 3.029 },
    visibility: "EXACT",
    verified: true,
  });
  const far = await createProvider({
    name: "Studio Lointain",
    commune: { nameFr: "Bab Ezzouar", lat: 36.721, lng: 3.183 },
    // Exact position is very close to the search point, but must NOT be used (commune only).
    exact: { lat: 36.746, lng: 3.03 },
    visibility: "COMMUNE_ONLY",
  });
  const oran = await createProvider({ name: "Oran Beauté", wilayaCode: 31, commune: { nameFr: "Oran", lat: 35.697, lng: -0.633 } });
  const pending = await createProvider({ name: "En attente", status: "PENDING_REVIEW" });

  const a = await createProfile(near.id, "nails", {
    slug: "near-nails", startingPrice: 3000, experienceYears: 8, specialties: ["gel"], services: ["Pose gel"], weekdays: [6, 0],
  });
  await createProfile(far.id, "nails", { slug: "far-nails", startingPrice: 1500, experienceYears: 2, services: ["Manucure 50% off"] });
  await createProfile(oran.id, "nails", { slug: "oran-nails", startingPrice: 2000, weekdays: [6] });
  await createProfile(near.id, "coiffeuses", { slug: "near-hair" });
  // Must never appear:
  await createProfile(near.id, "massage", { slug: "near-draft", status: "DRAFT" });
  await createProfile(oran.id, "massage", { slug: "oran-unpaid", billingVisible: false });
  await createProfile(pending.id, "nails", { slug: "pending-nails" });

  await createCompletedBookingWithReview(a.id, 5);
  await createCompletedBookingWithReview(a.id, 4);
  await db.scheduleException.create({ data: { profileId: a.id, date: new Date("2026-10-17T00:00:00Z"), isClosed: true } });
});

describe("directory visibility", () => {
  it("returns only published, billing-visible profiles of approved providers in the category", async () => {
    expect(slugs(await searchDirectory("nails", q()))).toEqual(["far-nails", "near-nails", "oran-nails"]);
    expect(slugs(await searchDirectory("massage", q()))).toEqual([]);
  });
});

describe("directory filters", () => {
  it("filters by wilaya and commune", async () => {
    expect(slugs(await searchDirectory("nails", q({ wilaya: "31" })))).toEqual(["oran-nails"]);
    expect(slugs(await searchDirectory("nails", q({ commune: "hydra" })))).toEqual(["near-nails"]);
  });

  it("matches service names and treats LIKE wildcards literally", async () => {
    expect(slugs(await searchDirectory("nails", q({ q: "pose gel" })))).toEqual(["near-nails"]);
    expect(slugs(await searchDirectory("nails", q({ q: "50%" })))).toEqual(["far-nails"]);
    expect(slugs(await searchDirectory("nails", q({ q: "%" })))).toEqual(["far-nails"]);
  });

  it("filters by price, experience, specialty, verified and rating", async () => {
    expect(slugs(await searchDirectory("nails", q({ maxPrice: "2000" })))).toEqual(["far-nails", "oran-nails"]);
    expect(slugs(await searchDirectory("nails", q({ minExperience: "5" })))).toEqual(["near-nails"]);
    expect(slugs(await searchDirectory("nails", q({ specialty: "gel" })))).toEqual(["near-nails"]);
    expect(slugs(await searchDirectory("nails", q({ verified: "1" })))).toEqual(["near-nails"]);
    expect(slugs(await searchDirectory("nails", q({ minRating: "4" })))).toEqual(["near-nails"]);
  });

  it("filters by opening day and respects closures", async () => {
    // 2026-10-18 is a Sunday: near-nails works Sundays.
    expect(slugs(await searchDirectory("nails", q({ date: "2026-10-18" })))).toEqual(["near-nails"]);
    // 2026-10-17 is a Saturday: near-nails is closed that day by exception; oran works Saturdays.
    expect(slugs(await searchDirectory("nails", q({ date: "2026-10-17" })))).toEqual(["oran-nails"]);
  });

  it("aggregates genuine reviews", async () => {
    const card = (await searchDirectory("nails", q())).cards.find((c) => c.slug === "near-nails")!;
    expect(card.reviewCount).toBe(2);
    expect(card.rating).toBe(4.5);
  });
});

describe("distance", () => {
  const here = { lat: "36.75", lng: "3.03" };

  it("sorts by distance using each provider's public position", async () => {
    const r = await searchDirectory("nails", q({ ...here, sort: "distance" }));
    expect(r.cards.map((c) => c.slug)).toEqual(["near-nails", "far-nails", "oran-nails"]);
    const far = r.cards.find((c) => c.slug === "far-nails")!;
    // Commune-only provider: distance from the Bab Ezzouar centroid (~13 km), never from her exact address (~0.4 km).
    expect(far.distanceKm).toBeGreaterThan(10);
  });

  it("applies the maximum distance", async () => {
    expect(slugs(await searchDirectory("nails", q({ ...here, maxKm: "5" })))).toEqual(["near-nails"]);
    expect(slugs(await searchDirectory("nails", q({ ...here, maxKm: "25" })))).toEqual(["far-nails", "near-nails"]);
  });
});

describe("public profile", () => {
  it("never exposes the street address or coordinates", async () => {
    const p = await getPublicProfile("near-nails");
    expect(p).not.toBeNull();
    const json = JSON.stringify(p);
    expect(json).not.toContain("rue privée");
    expect(json).not.toContain("36.747");
    expect(p!.reviewCount).toBe(2);
    expect(p!.reviews[0].author).toMatch(/^Client N\.$/);
    expect(p!.provider.otherProfiles.map((o) => o.slug)).toEqual(["near-hair"]);
  });

  it("returns null for drafts, unpaid and unapproved profiles", async () => {
    expect(await getPublicProfile("near-draft")).toBeNull();
    expect(await getPublicProfile("oran-unpaid")).toBeNull();
    expect(await getPublicProfile("pending-nails")).toBeNull();
  });

  it("lists only public profiles on the provider page", async () => {
    const provider = await getPublicProvider("p-1");
    expect(provider?.profiles.map((p) => p.slug).sort()).toEqual(["near-hair", "near-nails"]);
  });
});

describe("profile views", () => {
  it("counts one view per visitor per day and none for bots or hidden profiles", async () => {
    process.env.AUTH_SECRET ??= "test-secret";
    expect(await recordProfileView("near-nails", "1.2.3.4", "Mozilla/5.0", null)).toBe(true);
    expect(await recordProfileView("near-nails", "1.2.3.4", "Mozilla/5.0", null)).toBe(false);
    expect(await recordProfileView("near-nails", "5.6.7.8", "Mozilla/5.0", "https://www.instagram.com/x?y=1")).toBe(true);
    expect(await recordProfileView("near-nails", "9.9.9.9", "Googlebot", null)).toBe(false);
    expect(await recordProfileView("near-draft", "1.2.3.4", "Mozilla/5.0", null)).toBe(false);
    const events = await db.profileViewEvent.findMany({ select: { visitorHash: true, referrer: true } });
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.referrer)).toContain("www.instagram.com");
    expect(JSON.stringify(events)).not.toContain("1.2.3.4");
  });
});
