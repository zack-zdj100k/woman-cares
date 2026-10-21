import { cloudNameFrom, cloudinaryBase, deliveryPath, resourceTypeFor } from "./cloudinary-keys";

/**
 * Public media (portfolio images/videos, CMS assets) are served from PUBLIC_MEDIA_BASE_URL
 * (a CDN or bucket in production, /uploads locally). Private media (booking references,
 * credentials) never go through here: they are streamed by an authorised API route.
 */
export function publicMediaUrl(storageKey: string) {
  const encoded = storageKey.split("/").map(encodeURIComponent).join("/");
  const configured = process.env.PUBLIC_MEDIA_BASE_URL;

  if ((process.env.STORAGE_DRIVER ?? "local") === "cloudinary") {
    // A custom domain can be pinned with PUBLIC_MEDIA_BASE_URL; otherwise the cloud name gives the host.
    const cloudName = cloudNameFrom(process.env.CLOUDINARY_URL);
    const root = configured?.startsWith("http") ? configured : cloudName ? cloudinaryBase(cloudName) : null;
    if (root) {
      const path = deliveryPath(storageKey).split("/").map(encodeURIComponent).join("/");
      return `${root.replace(/\/$/, "")}/${resourceTypeFor(storageKey)}/upload/${path}`;
    }
  }

  return `${(configured ?? "/uploads").replace(/\/$/, "")}/${encoded}`;
}
