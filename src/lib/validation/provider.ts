import { z } from "zod";
import { normalizeDzPhone } from "./auth";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const socialUrl = (hosts: string[]) =>
  z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => {
      if (!v) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && hosts.includes(u.hostname);
      } catch {
        return false;
      }
    }, "url");

export const profileDetailsSchema = z.object({
  headline: z.string().trim().min(10).max(120),
  description: z.string().trim().min(40).max(3000),
  experienceYears: z.coerce.number().int().min(0).max(60).nullable().optional().catch(null),
  specialties: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(12).default([]),
  hygieneNotes: optionalText(1500),
  productNotes: optionalText(1500),
  cancellationPolicy: optionalText(1500),
  instagram: socialUrl(["instagram.com", "www.instagram.com"]),
  facebook: socialUrl(["facebook.com", "www.facebook.com", "m.facebook.com"]),
  tiktok: socialUrl(["tiktok.com", "www.tiktok.com"]),
});
export type ProfileDetails = z.infer<typeof profileDetailsSchema>;

const money = z.coerce.number().min(0).max(10_000_000).multipleOf(1);

export const serviceSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: optionalText(600),
    durationMinutes: z.coerce.number().int().min(10).max(600).multipleOf(5),
    bufferMinutes: z.coerce.number().int().min(0).max(120).multipleOf(5).default(0),
    priceMin: money,
    priceMax: money.nullable().optional().catch(null),
    active: z.boolean().default(true),
  })
  .refine((s) => s.priceMax == null || s.priceMax >= s.priceMin, { path: ["priceMax"], message: "range" });
export type ServiceInput = z.infer<typeof serviceSchema>;

/** "08:30" → 510. Quarter-hour steps keep the slot engine simple and predictable. */
export function hhmmToMinutes(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value) ?? (value === "24:00" ? [value, "24", "00"] : null);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes % 15 === 0 ? minutes : null;
}

export const windowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
    capacity: z.number().int().min(1).max(20),
  })
  .refine((w) => w.startMinute < w.endMinute && w.endMinute - w.startMinute >= 30, { message: "order" });
export type ScheduleWindow = z.infer<typeof windowSchema>;

/** Windows of the same weekday must not overlap (breaks are the gaps between them). */
export const weeklyScheduleSchema = z
  .array(windowSchema)
  .max(42)
  .superRefine((windows, ctx) => {
    for (let d = 0; d < 7; d++) {
      const day = windows.filter((w) => w.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < day.length; i++) {
        if (day[i].startMinute < day[i - 1].endMinute) ctx.addIssue({ code: "custom", message: "overlap", path: [d] });
      }
    }
  });

export const closureSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: optionalText(200),
  })
  .refine((c) => c.from <= c.to, { path: ["to"], message: "order" })
  .refine((c) => (Date.parse(c.to) - Date.parse(c.from)) / 86_400_000 <= 90, { path: ["to"], message: "length" });

export const businessSettingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  bio: optionalText(1500),
  publicPhone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = normalizeDzPhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "phone" });
      return n;
    })
    .nullable()
    .optional(),
  wilaya: z.coerce.number().int().min(1).max(58),
  commune: optionalText(80),
  addressLine: optionalText(200),
  workplaceType: z.enum(["SALON", "STUDIO", "HOME", "MOBILE"]),
  locationVisibility: z.enum(["EXACT", "APPROXIMATE", "COMMUNE_ONLY"]),
  latitude: z.coerce.number().min(18).max(38).nullable().optional().catch(null),
  longitude: z.coerce.number().min(-9).max(12.5).nullable().optional().catch(null),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;
