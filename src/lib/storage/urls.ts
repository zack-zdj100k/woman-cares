/**
 * Public media (portfolio images/videos, CMS assets) are served from
 * PUBLIC_MEDIA_BASE_URL (a CDN or bucket in production, /uploads locally).
 * Private media (booking references, credentials) never go through here:
 * they are streamed by an authorised API route with a short-lived signed token.
 */
export function publicMediaUrl(storageKey: string) {
  const base = process.env.PUBLIC_MEDIA_BASE_URL ?? "/uploads";
  return `${base.replace(/\/$/, "")}/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}
