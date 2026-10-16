import "server-only";
import { db } from "@/lib/db";
import { sendRaw } from "@/lib/email/transport";
import { renderEmail, type EmailTemplate, type TemplateData } from "@/lib/email/templates";
import { isLocale } from "@/i18n/config";
import type { Prisma } from "@/generated/prisma/client";

/** Anything that can write inside a transaction. */
type Tx = Pick<Prisma.TransactionClient, "outboxEvent">;

export type EmailPayload = { to: string; template: EmailTemplate; locale: string; data: TemplateData; dedupeKey: string };

/**
 * Writes the email intent in the SAME transaction as the business change.
 * If sending fails later, the business record is untouched and the event is retried.
 */
export function enqueueEmail(tx: Tx, payload: EmailPayload) {
  return tx.outboxEvent.create({ data: { type: "email", payload } });
}

const MAX_ATTEMPTS = 5;
const CLAIM_MS = 10 * 60_000;

/**
 * Delivers due email events. Safe to run concurrently: each event is claimed with a
 * conditional update, and EmailDeliveryLog.dedupeKey prevents sending the same message twice.
 */
export async function deliverPendingEmails(limit = 20, now = new Date()) {
  const due = await db.outboxEvent.findMany({
    where: { type: "email", status: { in: ["PENDING", "PROCESSING"] }, availableAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, status: true, attempts: true, payload: true },
  });
  let sent = 0;
  for (const event of due) {
    const claimed = await db.outboxEvent.updateMany({
      where: { id: event.id, status: event.status, availableAt: { lte: now } },
      data: { status: "PROCESSING", availableAt: new Date(now.getTime() + CLAIM_MS) },
    });
    if (claimed.count === 0) continue;

    const p = event.payload as unknown as EmailPayload;
    const existing = await db.emailDeliveryLog.findUnique({ where: { dedupeKey: p.dedupeKey } });
    if (existing?.status === "SENT") {
      await db.outboxEvent.update({ where: { id: event.id }, data: { status: "DONE", processedAt: new Date() } });
      continue;
    }

    const locale = isLocale(p.locale) ? p.locale : "fr";
    const email = renderEmail(p.template, locale, p.data);
    const log = await db.emailDeliveryLog.upsert({
      where: { dedupeKey: p.dedupeKey },
      update: { status: "SENDING", attempts: { increment: 1 } },
      create: { dedupeKey: p.dedupeKey, outboxEventId: event.id, toEmail: p.to, template: p.template, subject: email.subject, status: "SENDING", attempts: 1 },
    });

    try {
      const result = await sendRaw({ to: p.to, ...email });
      await db.$transaction([
        db.emailDeliveryLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date(), providerMessageId: result.providerMessageId, lastError: null } }),
        db.outboxEvent.update({ where: { id: event.id }, data: { status: "DONE", processedAt: new Date(), attempts: { increment: 1 } } }),
      ]);
      sent += 1;
    } catch (err) {
      const attempts = event.attempts + 1;
      const message = err instanceof Error ? err.message.slice(0, 500) : "send failed";
      await db.$transaction([
        db.emailDeliveryLog.update({ where: { id: log.id }, data: { status: "FAILED", lastError: message } }),
        db.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts,
            lastError: message,
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
            // Exponential backoff: 2, 4, 8, 16 minutes.
            availableAt: new Date(now.getTime() + 2 ** attempts * 60_000),
          },
        }),
      ]);
    }
  }
  return { processed: due.length, sent };
}
