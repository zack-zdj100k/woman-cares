/**
 * Builds tests/postman/woman-cares.postman_collection.json: every page and API of the site, checked
 * as each kind of visitor (guest, client, professional, support, admin, super admin), with status,
 * speed and "no crash page" assertions. Import it in Postman, or run it with:
 *   node tests/postman/build-collection.mjs && npx newman run tests/postman/woman-cares.postman_collection.json -e <env.json>
 * Environment: baseUrl, cookie_<ROLE>, profileSlug, providerSlug, profileId, serviceId, bookingId (see seed-audit.ts).
 */
import { writeFileSync } from "node:fs";

const locales = ["fr", "ar"];
const categories = ["coiffeuses", "esthetique", "massage", "nails", "extensions-de-cils", "botox"];
const MAX_MS = 3000; // generous: first hit of each page includes rendering after a cold start

const clientPages = ["", "/appointments", "/appointments/{{bookingId}}", "/notifications", "/profile"];
const providerPages = ["", "/account", "/analytics", "/bookings", "/bookings/{{bookingId}}", "/calendar", "/earnings", "/invoices", "/notifications", "/profiles", "/profiles/{{profileId}}", "/schedule", "/services", "/settings", "/subscriptions"];
const adminPages = ["", "/account", "/audit-logs", "/categories", "/invoices", "/messages", "/notifications", "/payments", "/pricing", "/providers", "/providers/{{providerId}}", "/settings", "/subscriptions", "/users", "/users/{{clientUserId}}"];

const crashText = ["Application error", "Internal Server Error", "This page couldn", "Unhandled Runtime Error"];

/*
 * Pages stream: when a 404 or a sign-in redirect is decided inside a Suspense boundary, the shell has
 * already gone out with HTTP 200. The page is still the not-found page (with robots noindex) or a
 * redirect, so for those checks we accept either the HTTP code or that marker in the body.
 */
const streamed = {
  404: "NEXT_HTTP_ERROR_FALLBACK;404",
  redirect: "NEXT_REDIRECT;replace;/fr/auth/sign-in",
};
function test(name, { expect, maxMs = MAX_MS, redirectTo, soft }) {
  const codes = Array.isArray(expect) ? expect : [expect];
  const statusCheck = soft
    ? `pm.test("${soft} (HTTP or streamed)", () => { const ok = ${JSON.stringify(codes)}.includes(pm.response.code) || (pm.response.code === 200 && pm.response.text().includes(${JSON.stringify(streamed[soft])})); pm.expect(ok, "got " + pm.response.code).to.be.true; });`
    : `pm.test("status ${codes.join("/")}", () => pm.expect(${JSON.stringify(codes)}).to.include(pm.response.code));`;
  const lines = [
    statusCheck,
    `pm.test("no server crash text", () => { const t = pm.response.text(); ${JSON.stringify(crashText)}.forEach((c) => pm.expect(t).to.not.include(c)); });`,
    `pm.test("fast (< ${maxMs} ms)", () => pm.expect(pm.response.responseTime).to.be.below(${maxMs}));`,
  ];
  if (redirectTo) lines.push(`pm.test("redirects to ${redirectTo}", () => pm.expect(pm.response.headers.get("Location") || "").to.include(${JSON.stringify(redirectTo)}));`);
  return { listen: "test", script: { type: "text/javascript", exec: lines } };
}

function req(name, path, { cookie, expect = 200, redirect = true, method = "GET", maxMs, redirectTo, body, soft } = {}) {
  const header = cookie ? [{ key: "Cookie", value: `{{cookie_${cookie}}}` }] : [];
  const item = {
    name,
    event: [test(name, { expect, maxMs, redirectTo, soft })],
    request: { method, header, url: `{{baseUrl}}${path}`, ...(body ? { body: { mode: "raw", raw: body, options: { raw: { language: "json" } } } } : {}) },
  };
  if (!redirect) item.protocolProfileBehavior = { followRedirects: false };
  return item;
}

const folder = (name, item) => ({ name, item });
const items = [];

const notFoundCheck = { expect: 404, soft: 404 };

// 1. Public pages as a guest.
const publicItems = [];
for (const l of locales) {
  const pages = ["", "/about-platform", "/about-services", "/contact", "/auth/sign-in", "/auth/sign-up", "/auth/forgot-password", "/legal/privacy", "/legal/terms", ...categories.map((c) => `/${c}`), "/profiles/{{profileSlug}}", "/providers/{{providerSlug}}"];
  for (const p of pages) publicItems.push(req(`${l} ${p || "/"}`, `/${l}${p}`));
}
publicItems.push(req("robots.txt", "/robots.txt"), req("sitemap.xml", "/sitemap.xml"));
publicItems.push(req("unknown page is a clean 404", "/fr/does-not-exist", notFoundCheck));
publicItems.push(req("unknown profile is a clean 404", "/fr/profiles/nobody-here", notFoundCheck));
publicItems.push(req("unknown locale is a clean 404", "/xx", notFoundCheck));
items.push(folder("1 Public pages (guest)", publicItems));

// 2. Public APIs.
items.push(folder("2 Public APIs", [
  req("availability (14 days)", "/api/v1/profiles/{{profileSlug}}/availability?serviceId={{serviceId}}&days=14"),
  req("availability bad slug", "/api/v1/profiles/BAD SLUG!/availability", { expect: [404, 400] }),
  req("availability unknown profile", "/api/v1/profiles/nobody-here/availability?serviceId=x", { expect: 404 }),
  req("availability bad service id", "/api/v1/profiles/{{profileSlug}}/availability?serviceId=not-a-uuid", { expect: [200, 400, 404] }),
]));

// 3. Private areas and APIs must refuse a guest.
const guestItems = [];
for (const [area, pages] of [["client", clientPages], ["provider", providerPages], ["admin", adminPages]]) {
  for (const p of pages) guestItems.push(req(`guest → ${area}${p}`, `/fr/dashboard/${area}${p}`, { redirect: false, expect: [302, 303, 307, 308], redirectTo: "/auth/sign-in" }));
}
guestItems.push(req("guest → booking confirmation", "/fr/booking/sent/{{bookingId}}", { redirect: false, expect: [302, 303, 307, 308], soft: "redirect" }));
for (const [name, path, method] of [
  ["credential file", "/api/v1/admin/credentials/00000000-0000-0000-0000-000000000000/file", "GET"],
  ["own payment", "/api/v1/billing/own-payment", "POST"],
  ["avatar upload", "/api/v1/me/avatar", "POST"],
  ["booking references", "/api/v1/bookings/{{bookingId}}/references", "POST"],
  ["provider credentials", "/api/v1/provider/credentials", "POST"],
  ["profile media", "/api/v1/provider/profiles/{{profileId}}/media", "POST"],
  ["payment proof", "/api/v1/billing/payments/00000000-0000-0000-0000-000000000000/proof", "GET"],
  ["payment receipt", "/api/v1/billing/payments/00000000-0000-0000-0000-000000000000/receipt", "GET"],
  ["daily cron without secret (503 when no secret is configured)", "/api/cron/daily", "GET"],
]) guestItems.push(req(`guest → ${name}`, path, { method, expect: [401, 403, 404, 405, 400, 415, 503], redirect: false }));
items.push(folder("3 Guest is refused everywhere private", guestItems));

// 4. Each role in its own area (and refused in the others).
function roleFolder(role, area, pages, strict = true) {
  const out = [];
  for (const l of locales) for (const p of pages) out.push(req(`${role} ${l} ${area}${p || "/"}`, `/${l}/dashboard/${area}${p}`, { cookie: role, expect: strict ? 200 : [200, 404] }));
  return folder(`${role} → ${area}`, out);
}
const roles = [];
roles.push(roleFolder("CLIENT", "client", clientPages));
roles.push(folder("CLIENT booking confirmation", [req("CLIENT booking sent page", "/fr/booking/sent/{{bookingId}}", { cookie: "CLIENT" })]));
roles.push(roleFolder("PROVIDER", "provider", providerPages));
roles.push(roleFolder("SUPER_ADMIN", "admin", adminPages));
roles.push(roleFolder("ADMIN", "admin", adminPages, false));
roles.push(roleFolder("SUPPORT", "admin", adminPages, false));
const wrong = [];
for (const [role, area] of [["CLIENT", "provider"], ["CLIENT", "admin"], ["PROVIDER", "client"], ["PROVIDER", "admin"], ["SUPPORT", "client"], ["SUPPORT", "provider"], ["ADMIN", "client"], ["SUPER_ADMIN", "provider"]]) {
  wrong.push(req(`${role} cannot open ${area}`, `/fr/dashboard/${area}`, { cookie: role, ...notFoundCheck }));
}
roles.push(folder("Wrong area is hidden (404)", wrong));
items.push(folder("4 Signed-in roles", roles));

// 5. Speed: the busiest pages again, now warm.
const speed = [];
for (const [name, path, cookie] of [["home", "/fr", null], ["category", "/fr/coiffeuses", null], ["profile", "/fr/profiles/{{profileSlug}}", null], ["availability", "/api/v1/profiles/{{profileSlug}}/availability?serviceId={{serviceId}}&days=14", null], ["provider dashboard", "/fr/dashboard/provider", "PROVIDER"], ["admin dashboard", "/fr/dashboard/admin", "SUPER_ADMIN"]]) {
  for (let i = 1; i <= 3; i++) speed.push(req(`warm ${name} #${i}`, path, { cookie, maxMs: 1200 }));
}
items.push(folder("5 Warm speed (< 1.2 s)", speed));

writeFileSync(new URL("./woman-cares.postman_collection.json", import.meta.url), JSON.stringify({
  info: { name: "Woman Cares: full site audit", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  variable: [{ key: "baseUrl", value: "http://localhost:3100" }],
  item: items,
}, null, 2));
console.log("requests:", JSON.stringify(items).split('"request"').length - 1);
