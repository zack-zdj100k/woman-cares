"use client";

import { useEffect } from "react";

/** Records one profile view per page load. The server de-duplicates per visitor per day. */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const url = `/api/v1/profiles/${encodeURIComponent(slug)}/views`;
    // The page that led here (not this page) is what tells a professional where visitors come from.
    const body = JSON.stringify({ ref: document.referrer || null });
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    else fetch(url, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}
