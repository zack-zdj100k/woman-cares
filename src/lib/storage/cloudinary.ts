import { v2 as cloudinary } from "cloudinary";
import { deliveryPath, formatFor, publicIdFor, resourceTypeFor } from "./cloudinary-keys";

/**
 * Cloudinary driver (STORAGE_DRIVER=cloudinary), for hosts with no writable disk. Reached through
 * ./index.ts, which carries the server-only guard; seed scripts import it directly.
 *
 * Public media (portfolio, avatars) are delivered straight from the CDN. Private media (booking
 * reference photos, credentials, receipts) are uploaded as "authenticated": they cannot be fetched
 * without a signature, so they stay reachable only through the authorised routes that already guard
 * them. Credentials hold identity documents, so they are never made public here.
 */
type Visibility = "public" | "private";

let configured = false;

function sdk() {
  if (!configured) {
    const raw = process.env.CLOUDINARY_URL;
    if (!raw) throw new Error("CLOUDINARY_URL is not set (required by STORAGE_DRIVER=cloudinary).");
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("CLOUDINARY_URL is malformed: expected cloudinary://<api_key>:<api_secret>@<cloud_name>.");
    }
    if (!parsed.hostname || !parsed.username || !parsed.password) {
      throw new Error("CLOUDINARY_URL is incomplete: expected cloudinary://<api_key>:<api_secret>@<cloud_name>.");
    }
    cloudinary.config({
      cloud_name: parsed.hostname,
      api_key: decodeURIComponent(parsed.username),
      api_secret: decodeURIComponent(parsed.password),
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/** Public assets are delivered by the CDN; private ones need a signature even to be fetched once. */
const deliveryType = (visibility: Visibility) => (visibility === "public" ? "upload" : "authenticated");

export async function putObject(visibility: Visibility, key: string, data: Buffer) {
  const client = sdk();
  await new Promise<void>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: publicIdFor(key),
        format: formatFor(key),
        resource_type: resourceTypeFor(key),
        type: deliveryType(visibility),
        // Keys are random and never reused, so an existing one means a bug, not a legitimate replacement.
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (error) => (error ? reject(error) : resolve()),
    );
    stream.end(data);
  });
}

export async function getObject(visibility: Visibility, key: string): Promise<Buffer | null> {
  const client = sdk();
  const url = client.url(deliveryPath(key), {
    resource_type: resourceTypeFor(key),
    type: deliveryType(visibility),
    secure: true,
    sign_url: visibility === "private",
  });
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteObject(visibility: Visibility, key: string) {
  const client = sdk();
  await client.uploader.destroy(publicIdFor(key), {
    resource_type: resourceTypeFor(key),
    type: deliveryType(visibility),
    invalidate: true,
  });
}
