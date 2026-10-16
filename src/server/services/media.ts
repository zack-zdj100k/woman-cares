import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { deleteObject, putObject } from "@/lib/storage";
import type { Actor } from "@/server/policies/roles";
import { ForbiddenError } from "./admin-users";
import { LockedError, ownedProfile, type CacheTags } from "./provider-profiles";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGES_PER_PROFILE = 24;
export const MAX_VIDEOS_PER_PROFILE = 4;
const MAX_EDGE = 2400;

export type MediaKind = { kind: "image"; format: "jpeg" | "png" | "webp" } | { kind: "video"; mime: "video/mp4" | "video/quicktime" };

/** Identifies a file by its first bytes; the browser-declared type and the filename are never trusted. */
export function sniff(bytes: Uint8Array): MediaKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "image", format: "jpeg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a) return { kind: "image", format: "png" };
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", format: "webp" };
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "qt  ") return { kind: "video", mime: "video/quicktime" };
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(brand)) return { kind: "video", mime: "video/mp4" };
  }
  return null;
}

export type UploadError = "type" | "size" | "limit" | "corrupt";
export class UploadRejected extends Error {
  constructor(public reason: UploadError) {
    super(reason);
  }
}

/**
 * Re-encodes images: applies EXIF orientation, caps the longest edge at 2400 px and writes WebP.
 * Re-encoding removes all metadata (EXIF, GPS position, camera serials) and any payload hidden in the file.
 */
export async function processImage(input: Buffer) {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 60_000_000, failOn: "error" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new UploadRejected("corrupt");
  }
}

export async function addPortfolioMedia(actor: Actor, profileId: string, bytes: Buffer, altText: string | null): Promise<{ id: string; tags: CacheTags }> {
  const profile = await ownedProfile(actor, profileId);
  const kind = sniff(bytes);
  if (!kind) throw new UploadRejected("type");
  if (bytes.length > (kind.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) throw new UploadRejected("size");

  const count = await db.portfolioMedia.count({ where: { profileId, type: kind.kind === "image" ? "IMAGE" : "VIDEO" } });
  if (count >= (kind.kind === "image" ? MAX_IMAGES_PER_PROFILE : MAX_VIDEOS_PER_PROFILE)) throw new UploadRejected("limit");

  const id = randomUUID();
  let key: string;
  let data: Buffer;
  let width: number | null = null;
  let height: number | null = null;
  let mimeType: string;
  if (kind.kind === "image") {
    const out = await processImage(bytes);
    ({ data, width, height } = out);
    key = `profiles/${profileId}/${id}.webp`;
    mimeType = "image/webp";
  } else {
    // Videos are stored as uploaded (container checked, not transcoded); see docs/SECURITY.md.
    data = bytes;
    key = `profiles/${profileId}/${id}.${kind.mime === "video/quicktime" ? "mov" : "mp4"}`;
    mimeType = kind.mime;
  }

  await putObject("public", key, data);
  try {
    const [hasCard, last] = await Promise.all([
      db.portfolioMedia.count({ where: { profileId, isCardImage: true } }),
      db.portfolioMedia.aggregate({ where: { profileId }, _max: { sortOrder: true } }),
    ]);
    const first = kind.kind === "image" && hasCard === 0;
    await db.portfolioMedia.create({
      data: {
        id,
        profileId,
        type: kind.kind === "image" ? "IMAGE" : "VIDEO",
        storageKey: key,
        mimeType,
        width,
        height,
        altText: altText?.slice(0, 200) || null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        isCardImage: first,
        isCover: first,
      },
    });
  } catch (e) {
    await deleteObject("public", key); // no orphan files when the database write fails
    throw e;
  }
  return { id, tags: profile.status === "PUBLISHED" ? ["profiles", `profile:${profile.slug}`, `directory:${profile.category.slug}`] : [] };
}

async function ownedMedia(actor: Actor, mediaId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) throw new ForbiddenError();
  const media = await db.portfolioMedia.findUnique({ where: { id: mediaId } });
  if (!media) throw new ForbiddenError();
  const profile = await ownedProfile(actor, media.profileId);
  const tags = profile.status === "PUBLISHED" ? ["profiles", `profile:${profile.slug}`, `directory:${profile.category.slug}`] : [];
  return { media, profile, tags };
}

export async function deletePortfolioMedia(actor: Actor, mediaId: string) {
  const { media, tags } = await ownedMedia(actor, mediaId);
  await db.$transaction(async (tx) => {
    await tx.portfolioMedia.delete({ where: { id: media.id } });
    if (media.isCardImage) {
      const next = await tx.portfolioMedia.findFirst({ where: { profileId: media.profileId, type: "IMAGE" }, orderBy: { sortOrder: "asc" } });
      if (next) await tx.portfolioMedia.update({ where: { id: next.id }, data: { isCardImage: true, isCover: true } });
    }
  });
  await deleteObject("public", media.storageKey);
  return tags;
}

/** The image shown on directory cards and as the profile cover. */
export async function setCardImage(actor: Actor, mediaId: string) {
  const { media, tags } = await ownedMedia(actor, mediaId);
  if (media.type !== "IMAGE") throw new LockedError();
  await db.$transaction([
    db.portfolioMedia.updateMany({ where: { profileId: media.profileId, isCardImage: true }, data: { isCardImage: false, isCover: false } }),
    db.portfolioMedia.update({ where: { id: media.id }, data: { isCardImage: true, isCover: true } }),
  ]);
  return tags;
}

/** Moves one item up or down in the gallery order. */
export async function moveMedia(actor: Actor, mediaId: string, direction: -1 | 1) {
  const { media, tags } = await ownedMedia(actor, mediaId);
  const all = await db.portfolioMedia.findMany({ where: { profileId: media.profileId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((m) => m.id === media.id);
  const j = i + direction;
  if (j < 0 || j >= all.length) return tags;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((m, order) => db.portfolioMedia.update({ where: { id: m.id }, data: { sortOrder: order } })));
  return tags;
}

export async function updateMediaAlt(actor: Actor, mediaId: string, altText: string) {
  const { media, tags } = await ownedMedia(actor, mediaId);
  await db.portfolioMedia.update({ where: { id: media.id }, data: { altText: altText.trim().slice(0, 200) || null } });
  return tags;
}
