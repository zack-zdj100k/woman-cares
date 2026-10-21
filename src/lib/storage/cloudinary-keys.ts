/**
 * Translation between our storage keys and Cloudinary identifiers. Pure functions, no SDK and no
 * secrets, so both the driver and the public-URL helper can use them (and unit tests can cover them).
 *
 * Cloudinary stores the format apart from the public id for images and videos, but keeps the whole
 * filename for raw files (PDFs). `publicIdFor` and `deliveryPath` hide that difference.
 */
export type CloudinaryResource = "image" | "video" | "raw";

const VIDEO = new Set([".mp4", ".mov", ".webm"]);
/** Documents are stored raw: Cloudinary returns the exact bytes and never transforms them. */
const RAW = new Set([".pdf"]);

export function extensionOf(key: string) {
  const slash = key.lastIndexOf("/");
  const dot = key.lastIndexOf(".");
  return dot > slash + 1 ? key.slice(dot).toLowerCase() : "";
}

export function resourceTypeFor(key: string): CloudinaryResource {
  const ext = extensionOf(key);
  if (VIDEO.has(ext)) return "video";
  if (RAW.has(ext)) return "raw";
  return "image";
}

export function publicIdFor(key: string) {
  const ext = extensionOf(key);
  if (!ext || resourceTypeFor(key) === "raw") return key;
  return key.slice(0, -ext.length);
}

/** The path under `/{resource}/upload/` that delivers this key. */
export function deliveryPath(key: string) {
  return resourceTypeFor(key) === "raw" ? publicIdFor(key) : `${publicIdFor(key)}${extensionOf(key)}`;
}

/** The format Cloudinary should file the asset under (raw files keep it inside the public id). */
export function formatFor(key: string) {
  const ext = extensionOf(key);
  return !ext || resourceTypeFor(key) === "raw" ? undefined : ext.slice(1);
}

/** `cloudinary://key:secret@cloud-name` → `cloud-name`. Never returns the key or the secret. */
export function cloudNameFrom(cloudinaryUrl: string | undefined) {
  if (!cloudinaryUrl) return null;
  try {
    return new URL(cloudinaryUrl).hostname || null;
  } catch {
    return null;
  }
}

export function cloudinaryBase(cloudName: string) {
  return `https://res.cloudinary.com/${cloudName}`;
}
