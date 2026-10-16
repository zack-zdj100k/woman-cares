import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getAvailability } from "@/server/services/bookings";

/**
 * GET /api/v1/profiles/{slug}/availability?serviceId=…&from=YYYY-MM-DD&days=1..14
 * Free start times for one active service of a public profile (Algiers time). Never cached:
 * a request made a minute ago changes the answer. 120 requests per minute per IP.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/profiles/[slug]/availability">) {
  const { slug } = await ctx.params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (!rateLimit(`availability:${ip}`, 120, 60_000).ok) return NextResponse.json({ error: { code: "RATE_LIMITED" } }, { status: 429 });
  const sp = request.nextUrl.searchParams;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const days = await getAvailability(slug, sp.get("serviceId") ?? "", sp.get("from") ?? undefined, Number(sp.get("days")) || 14);
  if (!days) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  return NextResponse.json(
    {
      data: days.map((d) => ({
        date: d.date,
        weekday: d.weekday,
        slots: d.slots.map((s) => ({ startAt: s.startAt.toISOString(), minute: s.minute, remaining: s.remaining })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
