import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getObject, putObject, deleteObject } from "@/lib/storage";
import { canReview, canSignIn, type Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { LockedError } from "./provider-profiles";
import { UploadRejected, processImage, sniff } from "./media";

export const CREDENTIAL_TYPES = ["diploma", "training", "license", "other"] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];
export const MAX_CREDENTIAL_BYTES = 10 * 1024 * 1024;
export const MAX_CREDENTIALS_PER_PROVIDER = 12;

export function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

async function ownAccount(actor: Actor) {
  if (actor.role !== "PROVIDER" || !canSignIn(actor.status)) throw new ForbiddenError();
  const account = await db.providerAccount.findUnique({ where: { userId: actor.id } });
  if (!account) throw new ForbiddenError();
  if (account.status === "SUSPENDED" || account.status === "REJECTED") throw new LockedError();
  return account;
}

/**
 * Stores a qualification document in PRIVATE storage for staff review.
 * PDFs are kept as uploaded (header checked); photos are re-encoded (metadata stripped).
 * Only categories the provider has asked for (or already has) can receive documents.
 */
export async function addCredential(
  actor: Actor,
  input: { categorySlug: string; type: CredentialType; issuer: string | null; expiresAt: string | null },
  bytes: Buffer,
) {
  const account = await ownAccount(actor);
  if (bytes.length > MAX_CREDENTIAL_BYTES) throw new UploadRejected("size");
  const category = await db.category.findFirst({ where: { slug: input.categorySlug, active: true } });
  if (!category) throw new ForbiddenError();
  const linked =
    (await db.providerCategoryRequest.count({ where: { providerId: account.id, categoryId: category.id, status: "PENDING" } })) +
    (await db.providerServiceProfile.count({ where: { providerId: account.id, categoryId: category.id } }));
  if (linked === 0) throw new ForbiddenError();
  if ((await db.providerCredential.count({ where: { providerId: account.id } })) >= MAX_CREDENTIALS_PER_PROVIDER) throw new UploadRejected("limit");

  let data: Buffer;
  let ext: string;
  if (isPdf(bytes)) {
    data = bytes;
    ext = "pdf";
  } else {
    const kind = sniff(bytes);
    if (kind?.kind !== "image") throw new UploadRejected("type");
    data = (await processImage(bytes)).data;
    ext = "webp";
  }
  const key = `credentials/${account.id}/${randomUUID()}.${ext}`;
  await putObject("private", key, data);
  try {
    return await db.providerCredential.create({
      data: {
        providerId: account.id,
        categoryId: category.id,
        type: input.type,
        storageKey: key,
        issuer: input.issuer?.slice(0, 160) || null,
        expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T00:00:00Z`) : null,
      },
    });
  } catch (e) {
    await deleteObject("private", key);
    throw e;
  }
}

export async function listMyCredentials(actor: Actor) {
  const account = await db.providerAccount.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!account || actor.role !== "PROVIDER") throw new ForbiddenError();
  return db.providerCredential.findMany({
    where: { providerId: account.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, issuer: true, expiresAt: true, status: true, notes: true, createdAt: true, category: { select: { slug: true } } },
  });
}

/** Streams a credential to an ADMIN+ reviewer. Every opening is written to the audit log. */
export async function readCredentialFile(actor: Actor, credentialId: string) {
  if (!canReview(actor) || !/^[0-9a-f-]{36}$/i.test(credentialId)) throw new ForbiddenError();
  const credential = await db.providerCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new ForbiddenError();
  const data = await getObject("private", credential.storageKey);
  if (!data) throw new ForbiddenError();
  await db.auditLog.create({ data: { actorId: actor.id, action: "credential.view", entityType: "ProviderCredential", entityId: credential.id } });
  return { data, pdf: credential.storageKey.endsWith(".pdf") };
}

/** Approves or rejects a document. Audited. */
export async function reviewCredential(actor: Actor, credentialId: string, approve: boolean, note: string | null) {
  if (!canReview(actor) || !/^[0-9a-f-]{36}$/i.test(credentialId)) throw new ForbiddenError();
  const credential = await db.providerCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new ForbiddenError();
  const status = approve ? "APPROVED" : "REJECTED";
  await db.$transaction([
    db.providerCredential.update({ where: { id: credential.id }, data: { status, reviewedById: actor.id, reviewedAt: new Date(), notes: note?.slice(0, 1000) || null } }),
    db.auditLog.create({
      data: { actorId: actor.id, action: approve ? "credential.approve" : "credential.reject", entityType: "ProviderCredential", entityId: credential.id, metadata: { note } },
    }),
  ]);
}

/** A regulated category needs at least one approved, unexpired document for that category. */
export async function hasValidCredential(providerId: string, categoryId: string, now = new Date()) {
  const count = await db.providerCredential.count({
    where: { providerId, categoryId, status: "APPROVED", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
  return count > 0;
}
