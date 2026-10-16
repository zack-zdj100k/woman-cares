import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Media storage adapter.
 *  - public: portfolio images/videos and CMS assets, served at PUBLIC_MEDIA_BASE_URL (/uploads locally).
 *  - private: booking reference photos and credentials; only ever streamed by authorised routes.
 *
 * Drivers: "local" (files under STORAGE_LOCAL_DIR). An S3-compatible driver is planned (see docs/ROADMAP.md);
 * selecting it before it exists fails loudly instead of silently storing nowhere.
 */
export type Visibility = "public" | "private";

const KEY = /^[a-z0-9][a-z0-9_\-./]{0,199}$/;

export function assertSafeKey(key: string) {
  if (!KEY.test(key) || key.includes("..") || key.includes("//") || key.endsWith("/")) throw new Error("Invalid storage key");
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
};

export function contentTypeFor(key: string) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

function root(visibility: Visibility) {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") throw new Error(`Storage driver "${driver}" is not implemented yet. Use STORAGE_DRIVER=local.`);
  return path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".storage", visibility);
}

// Storage lives outside the app bundle (STORAGE_LOCAL_DIR), so file tracing must skip these runtime paths.
function fileFor(visibility: Visibility, key: string) {
  assertSafeKey(key);
  const base = root(visibility);
  const file = path.resolve(base, key);
  if (!file.startsWith(base + path.sep)) throw new Error("Invalid storage key");
  return file;
}

export async function putObject(visibility: Visibility, key: string, data: Buffer) {
  const file = fileFor(visibility, key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, data, { flag: "wx" }); // never overwrite: keys are random and unique
}

export async function getObject(visibility: Visibility, key: string): Promise<Buffer | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ fileFor(visibility, key));
  } catch {
    return null;
  }
}

export async function deleteObject(visibility: Visibility, key: string) {
  await rm(/*turbopackIgnore: true*/ fileFor(visibility, key), { force: true });
}
