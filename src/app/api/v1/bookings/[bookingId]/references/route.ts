import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { MAX_IMAGE_BYTES, UploadRejected } from "@/server/services/media";
import { addBookingReference } from "@/server/services/booking-references";

const error = (status: number, code: string) => NextResponse.json({ error: { code } }, { status });

/**
 * POST /api/v1/bookings/{bookingId}/references (multipart: file)
 * The client of the booking adds an example photo. Type is read from the bytes; the image is re-encoded.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/bookings/[bookingId]/references">) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!length || length > MAX_IMAGE_BYTES + 64 * 1024) return error(413, "TOO_LARGE");
  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  if (!rateLimit(`booking-ref:${user.id}`, 40, 60 * 60_000).ok) return error(429, "RATE_LIMITED");

  const { bookingId } = await ctx.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "BAD_FORM");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error(400, "NO_FILE");
  try {
    const { id } = await addBookingReference(user, bookingId, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return error(404, "NOT_FOUND");
    if (e instanceof UploadRejected) return error(422, e.reason.toUpperCase());
    throw e;
  }
}
