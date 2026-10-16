/**
 * Runs the subscription billing cycle once: issues due invoices, moves statuses with time and
 * recomputes directory visibility. Idempotent. Schedule daily in production (e.g. 02:00 Algiers).
 *
 *   npm run billing:cycle
 */
import "dotenv/config";
import { runBillingCycle } from "../src/server/services/billing";

runBillingCycle()
  .then((r) => {
    console.log(`Billing cycle: ${r.providers} professionals, ${r.invoices} invoices issued, ${r.changed} status changes.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
