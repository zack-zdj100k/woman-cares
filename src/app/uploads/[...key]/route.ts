import { NextResponse, type NextRequest } from "next/server";
import { assertSafeKey, contentTypeFor, getObject } from "@/lib/storage";

/**
 * Serves PUBLIC media from local storage. Keys are random and never reused, so responses are
 * cacheable forever. Private media are never reachable here (different storage root).
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/uploads/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  try {
    assertSafeKey(key);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const data = await getObject("public", key);
  if (!data) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(key),
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
