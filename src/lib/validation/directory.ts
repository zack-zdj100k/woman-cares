import { z } from "zod";

/**
 * Directory query contract, shared by the category pages and (Phase 5) GET /api/v1/profiles.
 * Invalid values are dropped rather than failing the whole page: a bad link still shows results.
 */
export const SORTS = ["relevance", "distance", "price", "price_desc", "rating"] as const;
export type DirectorySort = (typeof SORTS)[number];
export const PAGE_SIZE = 12;
export const MAX_KM_OPTIONS = [5, 10, 25, 50] as const;

const optionalInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max).optional().catch(undefined);
const optionalNum = (min: number, max: number) => z.coerce.number().min(min).max(max).optional().catch(undefined);
const optionalText = z.string().trim().min(1).max(80).optional().catch(undefined);

export const directoryQuerySchema = z.object({
  wilaya: optionalInt(1, 58),
  commune: optionalText,
  q: optionalText,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)))
    .optional()
    .catch(undefined),
  // Coordinates arrive rounded to 2 decimals (~1 km); re-round defensively.
  lat: optionalNum(18, 38).transform((v) => (v === undefined ? v : Math.round(v * 100) / 100)),
  lng: optionalNum(-9, 12.5).transform((v) => (v === undefined ? v : Math.round(v * 100) / 100)),
  maxKm: z.coerce
    .number()
    .int()
    .refine((n) => (MAX_KM_OPTIONS as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
  minPrice: optionalInt(0, 10_000_000),
  maxPrice: optionalInt(0, 10_000_000),
  minExperience: optionalInt(0, 60),
  minRating: optionalInt(1, 5),
  verified: z
    .enum(["1"])
    .optional()
    .catch(undefined)
    .transform((v) => v === "1"),
  specialty: z.string().regex(/^[a-z0-9-]{1,40}$/).optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  page: optionalInt(1, 500),
});

export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;

/** Accepts Next's searchParams record (first value wins for repeated keys). */
export function parseDirectoryQuery(raw: Record<string, string | string[] | undefined>): DirectoryQuery {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = directoryQuerySchema.parse(flat);
  // Distance sort without coordinates falls back to relevance; a max distance needs coordinates too.
  const hasCoords = parsed.lat !== undefined && parsed.lng !== undefined;
  return {
    ...parsed,
    sort: parsed.sort === "distance" && !hasCoords ? undefined : parsed.sort,
    maxKm: hasCoords ? parsed.maxKm : undefined,
    lat: hasCoords ? parsed.lat : undefined,
    lng: hasCoords ? parsed.lng : undefined,
  };
}

/** Builds the query string for a directory link, omitting defaults. */
export function directoryHref(locale: string, category: string, query: Partial<DirectoryQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === false || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, value === true ? "1" : String(value));
  }
  const qs = params.toString();
  return `/${locale}/${category}${qs ? `?${qs}` : ""}`;
}
