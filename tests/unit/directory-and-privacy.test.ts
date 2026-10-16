import { describe, expect, it } from "vitest";
import { directoryHref, parseDirectoryQuery } from "@/lib/validation/directory";
import { likePattern, weekdayOf } from "@/server/services/directory";
import { sanitizeSocialLinks, shortName } from "@/server/services/profiles";
import { algiersDay, isLikelyBot, visitorHash } from "@/server/services/analytics";
import { weeklyHours } from "@/lib/time";

describe("parseDirectoryQuery", () => {
  it("keeps valid filters and drops invalid ones instead of failing", () => {
    const q = parseDirectoryQuery({ wilaya: "16", minPrice: "abc", sort: "hack", q: "  balayage ", page: "0", verified: "1" });
    expect(q.wilaya).toBe(16);
    expect(q.minPrice).toBeUndefined();
    expect(q.sort).toBeUndefined();
    expect(q.q).toBe("balayage");
    expect(q.page).toBeUndefined();
    expect(q.verified).toBe(true);
  });

  it("rejects out-of-range wilaya and malformed dates", () => {
    const q = parseDirectoryQuery({ wilaya: "99", date: "2026-13-40" });
    expect(q.wilaya).toBeUndefined();
    expect(q.date).toBeUndefined();
  });

  it("re-rounds coordinates to ~1 km and ignores coordinates outside Algeria", () => {
    expect(parseDirectoryQuery({ lat: "36.75321", lng: "3.04187" })).toMatchObject({ lat: 36.75, lng: 3.04 });
    expect(parseDirectoryQuery({ lat: "48.85", lng: "2.35" }).lat).toBeUndefined();
  });

  it("drops distance sort and max distance without coordinates", () => {
    const q = parseDirectoryQuery({ sort: "distance", maxKm: "10" });
    expect(q.sort).toBeUndefined();
    expect(q.maxKm).toBeUndefined();
  });

  it("only accepts the offered distance options", () => {
    expect(parseDirectoryQuery({ lat: "36.7", lng: "3", maxKm: "10" }).maxKm).toBe(10);
    expect(parseDirectoryQuery({ lat: "36.7", lng: "3", maxKm: "7" }).maxKm).toBeUndefined();
  });

  it("uses the first value of repeated keys", () => {
    expect(parseDirectoryQuery({ wilaya: ["31", "16"] }).wilaya).toBe(31);
  });
});

describe("directoryHref", () => {
  it("omits empty values and page 1", () => {
    expect(directoryHref("fr", "nails", { wilaya: 16, q: "", page: 1, verified: false })).toBe("/fr/nails?wilaya=16");
    expect(directoryHref("ar", "massage", { verified: true, page: 3 })).toBe("/ar/massage?verified=1&page=3");
  });
});

describe("SQL helpers", () => {
  it("escapes LIKE wildcards so user text matches literally", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });

  it("computes the weekday of a calendar date", () => {
    expect(weekdayOf("2026-10-16")).toBe(5); // Friday
    expect(weekdayOf("2026-10-17")).toBe(6); // Saturday
  });
});

describe("public profile helpers", () => {
  it("shows reviewers as first name and initial", () => {
    expect(shortName("Amina Benali")).toBe("Amina B.");
    expect(shortName("Lina")).toBe("Lina");
    expect(shortName("  Nour El Houda  Kaci ")).toBe("Nour K.");
  });

  it("keeps only https links to known social networks", () => {
    const links = sanitizeSocialLinks({
      instagram: "https://www.instagram.com/salon",
      facebook: "http://facebook.com/x",
      tiktok: "https://evil.example/tiktok.com",
      website: "https://example.com",
      other: 42,
    });
    expect(links).toEqual([{ network: "instagram", url: "https://www.instagram.com/salon" }]);
    expect(sanitizeSocialLinks(null)).toEqual([]);
  });

  it("orders the week from Saturday and marks closed days", () => {
    const rows = weeklyHours([
      { weekday: 0, startMinute: 540, endMinute: 780 },
      { weekday: 0, startMinute: 840, endMinute: 1140 },
    ]);
    expect(rows.map((r) => r.weekday)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(rows[1].ranges).toEqual(["09:00 - 13:00", "14:00 - 19:00"]);
    expect(rows[0].ranges).toEqual([]);
  });
});

describe("view analytics privacy", () => {
  it("produces different visitor keys on different days for the same visitor", () => {
    const a = visitorHash("secret", "2026-10-16", "1.2.3.4", "UA");
    const b = visitorHash("secret", "2026-10-17", "1.2.3.4", "UA");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1.2.3.4");
    expect(visitorHash("secret", "2026-10-16", "1.2.3.4", "UA")).toBe(a);
  });

  it("uses the Algiers calendar day", () => {
    // 23:30 UTC on Oct 15 is 00:30 on Oct 16 in Algiers (UTC+1).
    expect(algiersDay(new Date("2026-10-15T23:30:00Z"))).toBe("2026-10-16");
  });

  it("ignores bots and empty user agents", () => {
    expect(isLikelyBot("Googlebot/2.1")).toBe(true);
    expect(isLikelyBot("")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(false);
  });
});
