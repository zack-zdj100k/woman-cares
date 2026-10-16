import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { TIMEZONE } from "@/i18n/config";
import { publicProfileWhere } from "./discovery";

const BOT_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python-requests/i;

/** Calendar day in Africa/Algiers as YYYY-MM-DD. */
export function algiersDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Anonymous visitor key: HMAC(secret, day | ip | user agent). Because the day is part of the input,
 * hashes cannot be linked across days, and the raw IP is never stored.
 */
export function visitorHash(secret: string, day: string, ip: string, userAgent: string) {
  return createHmac("sha256", secret).update(`${day}|${ip}|${userAgent}`).digest("base64url");
}

export function isLikelyBot(userAgent: string) {
  return !userAgent || BOT_UA.test(userAgent);
}

/** Records at most one view per (profile, visitor, day). Returns false when nothing was recorded. */
export async function recordProfileView(slug: string, ip: string, userAgent: string, referrer: string | null) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || isLikelyBot(userAgent)) return false;
  const profile = await db.providerServiceProfile.findFirst({ where: { slug, ...publicProfileWhere }, select: { id: true } });
  if (!profile) return false;
  const day = algiersDay();
  const result = await db.profileViewEvent.createMany({
    data: [
      {
        profileId: profile.id,
        visitorHash: visitorHash(secret, day, ip, userAgent),
        day: new Date(`${day}T00:00:00Z`),
        // Keep only the referring host, never full URLs (they can carry personal data).
        referrer: referrer ? safeHost(referrer) : null,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.slice(0, 120);
  } catch {
    return null;
  }
}
