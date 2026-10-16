import { isLocale, type Locale } from "@/i18n/config";

/**
 * Accepts only same-site relative paths under a locale (prevents open redirects such as
 * "//evil.example", "https://…", "/\evil" or "javascript:").
 */
export function safeNextPath(next: unknown, locale: Locale): string | null {
  if (typeof next !== "string" || next.length > 300) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return null;
  const first = next.split(/[/?#]/)[1] ?? "";
  if (!isLocale(first)) return null;
  if (first !== locale) return null;
  if (next.startsWith(`/${locale}/auth/`)) return null; // never bounce back into auth pages
  return next;
}
