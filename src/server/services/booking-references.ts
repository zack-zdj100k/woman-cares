import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { deleteObject, getObject, putObject } from "@/lib/storage";
import { canSignIn, isStaff, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { MAX_IMAGE_BYTES, UploadRejected, processImage, sniff } from "./media";

export const MAX_REFERENCES_PER_BOOKING = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Photos can still be added while the request is open or the appointment has not happened yet. */
const OPEN = ["PENDING", "ACCEPTED", "RESCHEDULE_PROPOSED"];

/** The client who made the booking adds example photos of the result she wants (private, images only). */
export async function addBookingReference(actor: Actor, bookingId: string, bytes: Buffer) {
  if (actor.role !== "CLIENT" || !canSignIn(actor.status) || !UUID.test(bookingId)) throw new ForbiddenError();
  const booking = await db.booking.findFirst({ where: { id: bookingId, clientId: actor.id }, select: { id: true, status: true } });
  if (!booking || !OPEN.includes(booking.status)) throw new ForbiddenError();
  const kind = sniff(bytes);
  if (!kind || kind.kind !== "image") throw new UploadRejected("type");
  if (bytes.length > MAX_IMAGE_BYTES) throw new UploadRejected("size");
  if ((await db.bookingReferenceMedia.count({ where: { bookingId } })) >= MAX_REFERENCES_PER_BOOKING) throw new UploadRejected("limit");

  const { data } = await processImage(bytes);
  const id = randomUUID();
  const key = `bookings/${bookingId}/${id}.webp`;
  await putObject("private", key, data);
  try {
    await db.bookingReferenceMedia.create({ data: { id, bookingId, storageKey: key, mimeType: "image/webp", sizeBytes: data.length } });
  } catch (e) {
    await deleteObject("private", key);
    throw e;
  }
  return { id };
}

/** The photos of one booking, for the client, the professional it belongs to, or verified staff. */
export async function listBookingReferenceIds(actor: Actor, bookingId: string) {
  if (!UUID.test(bookingId) || !(await canSee(actor, bookingId))) throw new ForbiddenError();
  const rows = await db.bookingReferenceMedia.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function readBookingReference(actor: Actor, bookingId: string, mediaId: string) {
  if (!UUID.test(bookingId) || !UUID.test(mediaId) || !(await canSee(actor, bookingId))) throw new ForbiddenError();
  const media = await db.bookingReferenceMedia.findFirst({ where: { id: mediaId, bookingId }, select: { storageKey: true } });
  const data = media && (await getObject("private", media.storageKey));
  if (!data) throw new ForbiddenError();
  return data;
}

async function canSee(actor: Actor, bookingId: string) {
  if (!canSignIn(actor.status)) return false;
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { clientId: true, provider: { select: { userId: true } } } });
  if (!b) return false;
  if (actor.id === b.clientId || actor.id === b.provider.userId) return true;
  return isStaff(actor.role) && actor.emailVerified;
}
