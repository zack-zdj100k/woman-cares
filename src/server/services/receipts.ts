import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { deleteObject, getObject, putObject } from "@/lib/storage";
import { canReview, canViewModeration, type Actor } from "@/server/policies/roles";
import { ForbiddenError, UUID } from "./admin-users";
import { BillingBlocked } from "./billing";
import { processImage, sniff, UploadRejected } from "./media";

/**
 * Receipts for accepted subscription payments: a file (PDF or photo, private storage) and/or a note
 * with the period paid ("from … to …"). Written by ADMIN and above; the professional reads her own.
 */
const MAX_BYTES = 10 * 1024 * 1024;

export async function attachReceipt(actor: Actor, paymentId: string, input: { file: Buffer | null; note: string | null; coveredFrom: Date | null; coveredTo: Date | null }) {
  if (!canReview(actor) || !UUID.test(paymentId)) throw new ForbiddenError();
  const payment = await db.subscriptionPayment.findUnique({ where: { id: paymentId }, include: { invoice: { select: { number: true, providerId: true } } } });
  if (!payment) throw new ForbiddenError();
  if (payment.status !== "PAID") throw new BillingBlocked("state");
  const note = input.note?.trim().slice(0, 1000) || null;
  if (input.coveredFrom && input.coveredTo && input.coveredTo < input.coveredFrom) throw new BillingBlocked("date");
  if (!input.file && !note && !input.coveredFrom && !input.coveredTo) throw new BillingBlocked("note");

  let key: string | null = null;
  if (input.file) {
    if (input.file.length > MAX_BYTES) throw new UploadRejected("size");
    const isPdf = input.file.subarray(0, 5).toString("latin1") === "%PDF-";
    const kind = sniff(input.file);
    if (!isPdf && kind?.kind !== "image") throw new UploadRejected("type");
    key = `receipts/${payment.invoice.providerId}/${paymentId}-${randomUUID().slice(0, 8)}.${isPdf ? "pdf" : "webp"}`;
    await putObject("private", key, isPdf ? input.file : (await processImage(input.file)).data);
  }
  const old = payment.receiptKey;
  await db.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id: paymentId },
      data: { ...(key ? { receiptKey: key } : {}), receiptNote: note, coveredFrom: input.coveredFrom, coveredTo: input.coveredTo },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "subscription.receipt.attach", entityType: "SubscriptionPayment", entityId: paymentId, metadata: { invoice: payment.invoice.number, file: Boolean(key), note: Boolean(note) } } });
    // The professional is told a receipt is available (in-app only).
    const owner = await tx.providerAccount.findUniqueOrThrow({ where: { id: payment.invoice.providerId }, select: { userId: true } });
    await tx.notification.create({ data: { userId: owner.userId, type: "billing.receipt", title: `Reçu disponible : ${payment.invoice.number}`, body: note ?? "Votre reçu de paiement est disponible dans Factures.", data: { path: "/dashboard/provider/invoices" } } });
  });
  if (key && old) await deleteObject("private", old).catch(() => {});
}

/** The receipt file, for staff or the professional the payment belongs to. */
export async function readReceipt(actor: Actor, paymentId: string) {
  if (!UUID.test(paymentId)) throw new ForbiddenError();
  const p = await db.subscriptionPayment.findUnique({ where: { id: paymentId }, select: { receiptKey: true, invoice: { select: { number: true, provider: { select: { userId: true } } } } } });
  if (!p?.receiptKey) throw new ForbiddenError();
  const own = actor.role === "PROVIDER" && p.invoice.provider.userId === actor.id;
  if (!own && !canViewModeration(actor)) throw new ForbiddenError();
  const data = await getObject("private", p.receiptKey);
  if (!data) throw new ForbiddenError();
  return { data, pdf: p.receiptKey.endsWith(".pdf"), name: `recu-${p.invoice.number}` };
}
