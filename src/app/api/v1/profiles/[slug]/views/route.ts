import { NextResponse, type NextRequest } from "next/server";
import { recordProfileView } from "@/server/services/analytics";

/** POST /api/v1/profiles/{slug}/views. Always 204: the response never reveals whether a view counted. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/profiles/[slug]/views">) {
  const { slug } = await ctx.params;
  if (/^[a-z0-9-]{1,120}$/.test(slug)) {
    // First hop of X-Forwarded-For is only trustworthy behind our own proxy (see docs/SECURITY.md).
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const body = (await request.json().catch(() => null)) as { ref?: unknown } | null;
    const ref = typeof body?.ref === "string" ? body.ref.slice(0, 500) : null;
    await recordProfileView(slug, ip, request.headers.get("user-agent") ?? "", ref).catch(() => false);
  }
  return new NextResponse(null, { status: 204 });
}
