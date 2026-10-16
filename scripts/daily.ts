/**
 * Daily maintenance, idempotent: expires booking requests nobody answered, then runs the
 * subscription billing cycle. Schedule once a day in production (e.g. 02:00 Algiers).
 *
 *   npm run daily
 */
import "dotenv/config";
import { expirePendingBookings } from "../src/server/services/booking-lifecycle";
import { runBillingCycle } from "../src/server/services/billing";
import { deliverPendingEmails } from "../src/server/services/outbox";

async function main() {
  const bookings = await expirePendingBookings();
  const billing = await runBillingCycle();
  const mail = await deliverPendingEmails();
  console.log(`Bookings expired: ${bookings.expired}. Billing: ${billing.providers} professionals, ${billing.invoices} invoices issued, ${billing.changed} status changes.`);
  console.log(`Outbox:`, mail);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
