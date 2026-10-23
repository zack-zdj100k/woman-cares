import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getObject, putObject } from "@/lib/storage";
import { canVerifyPayment, type Actor } from "@/server/policies/roles";
import { ForbiddenError, UUID } from "./admin-users";
import { processImage, sniff, UploadRejected } from "./media";

/**
 * The proof a professional attaches when she declares a transfer (receipt photo, screenshot or PDF).
 * Private storage; read by the Super Admins who confirm payments and by the professional herself.
 * Images are re-encoded (which drops their metadata); PDFs are checked by their signature. 4 MB at
 * most: the hosting refuses larger requests (the page shrinks photos before sending them).
 */
export const PROOF_MAX_BYTES = 4 * 1024 * 1024;

export async function storePaymentProof(providerId: string, paymentId: string, file: Buffer) {
  if (file.length > PROOF_MAX_BYTES) throw new UploadRejected("size");
  const isPdf = file.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!isPdf && sniff(file)?.kind !== "image") throw new UploadRejected("type");
  const key = `payment-proofs/${providerId}/${paymentId}-${randomUUID().slice(0, 8)}.${isPdf ? "pdf" : "webp"}`;
  await putObject("private", key, isPdf ? file : (await processImage(file)).data);
  return key;
}

export async function readPaymentProof(actor: Actor, paymentId: string) {
  if (!UUID.test(paymentId)) throw new ForbiddenError();
  const p = await db.subscriptionPayment.findUnique({ where: { id: paymentId }, select: { proofStorageKey: true, invoice: { select: { number: true, provider: { select: { userId: true } } } } } });
  if (!p?.proofStorageKey) throw new ForbiddenError();
  const own = actor.role === "PROVIDER" && p.invoice.provider.userId === actor.id;
  if (!own && !canVerifyPayment(actor)) throw new ForbiddenError();
  const data = await getObject("private", p.proofStorageKey);
  if (!data) throw new ForbiddenError();
  return { data, pdf: p.proofStorageKey.endsWith(".pdf"), name: `preuve-${p.invoice.number}` };
}
