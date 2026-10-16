import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processImage, sniff } from "@/server/services/media";
import { closureSchema, hhmmToMinutes, profileDetailsSchema, serviceSchema, weeklyScheduleSchema, businessSettingsSchema } from "@/lib/validation/provider";
import { canEditProfile, canSubmitProfile } from "@/server/policies/roles";
import { algiersParts, datesBetween } from "@/lib/time";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("file sniffing (never trusts names or declared types)", () => {
  it("recognises real image and video signatures", () => {
    expect(sniff(bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ kind: "image", format: "jpeg" });
    expect(sniff(bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ kind: "image", format: "png" });
    expect(sniff(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toEqual({ kind: "image", format: "webp" });
    expect(sniff(bytes([0, 0, 0, 0x18], "ftypisom"))).toEqual({ kind: "video", mime: "video/mp4" });
    expect(sniff(bytes([0, 0, 0, 0x14], "ftypqt  "))).toEqual({ kind: "video", mime: "video/quicktime" });
  });

  it("rejects everything else, including SVG, HTML, PDF and HEIC", () => {
    expect(sniff(bytes("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniff(bytes("<script>alert(1)</script>"))).toBeNull();
    expect(sniff(bytes("%PDF-1.7"))).toBeNull();
    expect(sniff(bytes([0, 0, 0, 0x18], "ftypheic"))).toBeNull();
    expect(sniff(bytes("GIF89a"))).toBeNull();
    expect(sniff(new Uint8Array())).toBeNull();
  });
});

describe("image processing", () => {
  it("strips EXIF (including GPS), applies orientation and caps the longest edge", async () => {
    const withGps = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#c88" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "36/1 45/1 0/1" } })
      .toBuffer();
    const source = await sharp(withGps).metadata();
    expect(source.exif).toBeDefined();
    expect(source.orientation).toBe(6);

    const out = await processImage(withGps);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    // Orientation 6 rotates 90°: the 3000×1000 landscape becomes portrait, longest edge capped at 2400.
    expect(Math.max(out.width, out.height)).toBe(2400);
    expect(out.height).toBeGreaterThan(out.width);
  });

  it("rejects bytes that only pretend to be an image", async () => {
    await expect(processImage(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]))).rejects.toMatchObject({ reason: "corrupt" });
  });
});

describe("schedule validation", () => {
  const w = (weekday: number, start: string, end: string, capacity = 1) => ({ weekday, startMinute: hhmmToMinutes(start)!, endMinute: hhmmToMinutes(end)!, capacity });

  it("parses quarter-hour times only", () => {
    expect(hhmmToMinutes("08:30")).toBe(510);
    expect(hhmmToMinutes("24:00")).toBe(1440);
    expect(hhmmToMinutes("08:10")).toBeNull();
    expect(hhmmToMinutes("25:00")).toBeNull();
  });

  it("accepts split shifts and rejects overlaps, tiny ranges and bad capacity", () => {
    expect(weeklyScheduleSchema.safeParse([w(6, "09:00", "13:00"), w(6, "14:00", "19:00", 3)]).success).toBe(true);
    expect(weeklyScheduleSchema.safeParse([w(6, "09:00", "13:00"), w(6, "12:00", "19:00")]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([w(6, "09:00", "09:15")]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([w(6, "13:00", "09:00")]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([w(6, "09:00", "13:00", 0)]).success).toBe(false);
    expect(weeklyScheduleSchema.safeParse([w(6, "09:00", "13:00"), w(0, "09:00", "13:00")]).success).toBe(true);
  });

  it("limits closures to ordered ranges of at most 90 days", () => {
    expect(closureSchema.safeParse({ from: "2026-11-01", to: "2026-11-03" }).success).toBe(true);
    expect(closureSchema.safeParse({ from: "2026-11-03", to: "2026-11-01" }).success).toBe(false);
    expect(closureSchema.safeParse({ from: "2026-01-01", to: "2026-06-01" }).success).toBe(false);
  });
});

describe("service and profile validation", () => {
  it("requires sane durations and price ranges", () => {
    const base = { name: "Pose gel", durationMinutes: "90", bufferMinutes: "0", priceMin: "3500", priceMax: null, active: true };
    expect(serviceSchema.safeParse(base).success).toBe(true);
    expect(serviceSchema.safeParse({ ...base, durationMinutes: "7" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, priceMax: "2000" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, priceMin: "-1" }).success).toBe(false);
  });

  it("only accepts https links to the matching social network", () => {
    const base = { headline: "Semi-permanent et nail art", description: "x".repeat(40) };
    expect(profileDetailsSchema.safeParse({ ...base, instagram: "https://www.instagram.com/a" }).success).toBe(true);
    expect(profileDetailsSchema.safeParse({ ...base, instagram: "http://www.instagram.com/a" }).success).toBe(false);
    expect(profileDetailsSchema.safeParse({ ...base, instagram: "https://evil.example/instagram.com" }).success).toBe(false);
    expect(profileDetailsSchema.safeParse({ ...base, facebook: "javascript:alert(1)" }).success).toBe(false);
    expect(profileDetailsSchema.safeParse({ ...base, description: "trop court" }).success).toBe(false);
  });

  it("normalises the public phone and validates visibility", () => {
    const base = { businessName: "Atelier", wilaya: "16", workplaceType: "SALON", locationVisibility: "APPROXIMATE" };
    const ok = businessSettingsSchema.safeParse({ ...base, publicPhone: "0550 11 22 33" });
    expect(ok.success && ok.data.publicPhone).toBe("+213550112233");
    expect(businessSettingsSchema.safeParse({ ...base, publicPhone: "12" }).success).toBe(false);
    expect(businessSettingsSchema.safeParse({ ...base, locationVisibility: "PUBLIC" }).success).toBe(false);
  });
});

describe("profile editing policy", () => {
  it("blocks edits on restricted, suspended or archived profiles and on suspended accounts", () => {
    expect(canEditProfile("DRAFT", "ONBOARDING")).toBe(true);
    expect(canEditProfile("PUBLISHED", "APPROVED")).toBe(true);
    expect(canEditProfile("RESTRICTED", "APPROVED")).toBe(false);
    expect(canEditProfile("SUSPENDED", "APPROVED")).toBe(false);
    expect(canEditProfile("ARCHIVED", "APPROVED")).toBe(false);
    expect(canEditProfile("DRAFT", "SUSPENDED")).toBe(false);
  });

  it("only sends drafts to review", () => {
    expect(canSubmitProfile("DRAFT", "ONBOARDING")).toBe(true);
    expect(canSubmitProfile("PENDING_REVIEW", "PENDING_REVIEW")).toBe(false);
    expect(canSubmitProfile("PUBLISHED", "APPROVED")).toBe(false);
  });
});

describe("Algiers time helpers", () => {
  it("converts instants to local date, weekday and minutes (UTC+1, no DST)", () => {
    expect(algiersParts(new Date("2026-10-17T08:30:00Z"))).toEqual({ date: "2026-10-17", weekday: 6, minutes: 570 });
    expect(algiersParts(new Date("2026-10-16T23:30:00Z"))).toEqual({ date: "2026-10-17", weekday: 6, minutes: 30 });
  });

  it("lists every day of a range", () => {
    expect(datesBetween("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});
