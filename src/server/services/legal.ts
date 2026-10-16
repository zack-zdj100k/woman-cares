import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { legalDrafts, type LegalDoc, type LegalDocKey } from "@/content/legal";
import type { Locale } from "@/i18n/config";

/**
 * The latest Admin-published version wins; otherwise the bundled provisional draft is shown
 * with a visible notice. Published bodies are stored as JSON `LegalDoc` text.
 */
export async function getLegalDocument(doc: LegalDocKey, locale: Locale): Promise<{ doc: LegalDoc; draft: boolean; publishedAt: string | null }> {
  "use cache";
  cacheLife("hours");
  cacheTag("legal");

  const published = await db.legalDocumentVersion.findFirst({
    where: { kind: doc === "privacy" ? "PRIVACY" : "TERMS", locale, publishedAt: { not: null } },
    orderBy: { version: "desc" },
    select: { body: true, publishedAt: true },
  });
  if (published) {
    try {
      return { doc: JSON.parse(published.body) as LegalDoc, draft: false, publishedAt: published.publishedAt!.toISOString() };
    } catch {
      // Malformed body: fall back to the draft rather than breaking the page.
    }
  }
  return { doc: legalDrafts[doc][locale], draft: true, publishedAt: null };
}
