import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";

const LOCALE_COOKIE = "wc_locale";
/** Must match SESSION_COOKIE in src/lib/auth/session.ts (that module is server-only). */
const SESSION_COOKIE_NAME = "wc_session";

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && isLocale(saved)) return saved;

  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().slice(0, 2), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((entry) => isLocale(entry.lang));
  return match ? (match.lang as Locale) : defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasLocale = locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) {
    // Optimistic check only (no database): visitors without a session cookie go straight to sign-in.
    // The real authorization runs on the server in every dashboard page (requireArea).
    const dashboard = pathname.match(/^\/(fr|ar)\/dashboard(\/|$)/);
    if (dashboard && !request.cookies.has(SESSION_COOKIE_NAME)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${dashboard[1]}/auth/sign-in`;
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals and any file with an extension (media, images, icons).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
