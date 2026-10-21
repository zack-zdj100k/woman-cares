import { NextResponse, type NextRequest } from "next/server";
import { expirePendingBookings } from "@/server/services/booking-lifecycle";
import { runBillingCycle } from "@/server/services/billing";
import { deliverPendingEmails } from "@/server/services/outbox";

/**
 * The daily job (same work as `npm run daily`), for a host that runs it on a schedule:
 * expire unanswered booking requests, run the billing cycle that issues invoices, and
 * push whatever is waiting in the outbox.
 *
 * Only the scheduler may call it: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Without CRON_SECRET set the route refuses everyone, so it can never run unprotected.
 */
// It reads the Authorization header, so it is dynamic by nature; cacheComponents forbids
// declaring that with a route segment config.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORISED" } }, { status: 401 });
  }

  const startedAt = Date.now();
  const bookings = await expirePendingBookings();
  const billing = await runBillingCycle();
  const outbox = await deliverPendingEmails();
  return NextResponse.json({
    data: { bookingsExpired: bookings.expired, billing, outbox, ms: Date.now() - startedAt },
  });
}
