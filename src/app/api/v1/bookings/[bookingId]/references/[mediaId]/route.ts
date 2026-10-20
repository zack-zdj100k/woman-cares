import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/server/services/admin-users";
import { readBookingReference } from "@/server/services/booking-references";

/** GET: one example photo (the client, the professional of the booking, or verified staff). Never cached. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/bookings/[bookingId]/references/[mediaId]">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { bookingId, mediaId } = await ctx.params;
  try {
    const data = await readBookingReference(user, bookingId, mediaId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new NextResponse(null, { status: 404 });
    throw e;
  }
}
