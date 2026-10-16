/**
 * Delivers due emails from the outbox (retries included). Requests already trigger delivery
 * right after responding; schedule this every minute (cron, systemd timer, platform scheduler)
 * so retries and anything missed after a crash still go out.
 *
 *   npm run outbox:deliver
 */
import "dotenv/config";
import { deliverPendingEmails } from "../src/server/services/outbox";

deliverPendingEmails(100)
  .then((r) => {
    console.log(`Outbox: ${r.processed} processed, ${r.sent} sent.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
