# API specification (`/api/v1`)

Status: **mostly designed, not implemented yet** (Phases 3–11). Implemented: `POST /profiles/{slug}/views` ✅. Implemented endpoints will be marked ✅ and
an OpenAPI document will be generated from the shared Zod schemas once the first module ships.

## Conventions

- JSON only. Request bodies and query strings are validated with Zod; unknown fields are rejected.
- Success: `{ "data": … , "meta"?: { "page", "pageSize", "total" } }`.
- Error: `{ "error": { "code": "SLOT_FULL", "message": "…", "fields"?: { "field": "reason" } } }`.
- Status codes: 200/201, 204, 400 validation, 401 no session, 403 policy denied, 404 not found
  (also used when a resource exists but the caller may not know it), 409 conflict (state, capacity,
  duplicates), 422 business rule, 429 rate limited.
- Pagination: `?page=1&pageSize=20`, `pageSize ≤ 50`.
- Mutations that create money or capacity records accept an `Idempotency-Key` header.
- Auth: HTTP-only, `Secure`, `SameSite=Lax` session cookie (opaque token, SHA-256 stored server-side).
  Mutating requests from the browser also require the `Origin` to match `APP_URL` (CSRF defence).
- Every handler: parse → session → policy → service. Resource ownership is always re-checked on the server.

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | Active categories, ordered. |
| GET | `/profiles` | Directory search: `category` (required), `wilaya`, `commune`, `q`, `date`, `lat`,`lng` (2 dp), `maxKm`, `minPrice`, `maxPrice`, `verified`, `sort=relevance|distance|price|rating`, pagination. Only publicly visible profiles. |
| GET | `/profiles/{slug}` | Public profile, services, ordered media, weekly hours, rating summary. |
| GET | `/profiles/{slug}/availability?serviceId&from&to` | Slots for ≤ 31 days. Display only; booking re-checks. |
| GET | `/profiles/{slug}/reviews` | Published reviews, paginated. |
| POST | `/profiles/{slug}/views` ✅ | Records a privacy-conscious view: HMAC(secret, day, IP, UA), one per visitor per day, bots ignored, only the referrer host kept. Always 204. |
| GET | `/content/{page}?locale=` | Published CMS sections. |
| POST | `/support` | Contact form (rate limited). The site currently uses a Server Action (`src/app/[locale]/contact/actions.ts`); the REST endpoint arrives with the API module. |

## Auth

Implemented as Server Actions in `src/app/[locale]/auth/actions.ts` (same-origin only, rate-limited,
Zod-validated): `signUpAction`, `signInAction`, `signOutAction`, `verifyEmailAction`, `forgotPasswordAction`,
`resetPasswordAction`, `resendVerificationAction`. The REST equivalents below will wrap the same services
(`src/server/services/auth.ts`) for mobile clients.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/sign-up` | `role=client|provider`; provider payload adds business name, wilaya, workplace type, categories. |
| POST | `/auth/sign-in` | Rate limited per IP and per account; lockout after repeated failures. |
| POST | `/auth/sign-out` | |
| POST | `/auth/verify-email` | Single-use hashed token. |
| POST | `/auth/password/forgot` · `/auth/password/reset` | Always 204 on forgot (no account enumeration). |
| GET | `/me` | Current user, role, provider summary. |

## Client

| Method | Path | Notes |
|---|---|---|
| POST | `/bookings` | `profileId`, `serviceId`, `startAt`, `note?`, `Idempotency-Key`. Transactional capacity check. |
| POST | `/bookings/{id}/references` | Multipart image ≤ 8 MB (JPEG/PNG/WebP/HEIC, magic-byte checked). Private. |
| GET | `/me/bookings` · `/me/bookings/{id}` | Own bookings only. |
| POST | `/me/bookings/{id}/cancel` · `/accept-reschedule` · `/decline-reschedule` | State machine enforced. |
| GET/PUT/DELETE | `/me/favorites/{profileId}` | |
| POST | `/me/bookings/{id}/review` | Only `COMPLETED`, once. |
| GET/PATCH | `/me/notifications` | |
| PATCH | `/me` | Profile, locale, preferred wilaya, notification preferences. |

## Provider

The professional space currently uses Server Actions (`src/app/[locale]/dashboard/provider/actions.ts`)
over the services in `src/server/services/provider-profiles.ts` and `media.ts`; every one re-checks
ownership from the session. The REST routes below will wrap the same services.

| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/provider/account` | |
| GET/POST | `/provider/profiles` | One per category; creating a new category profile requires an approved category request. |
| PATCH | `/provider/profiles/{id}` | Submit for review, save draft, reorder media, choose card image. |
| CRUD | `/provider/profiles/{id}/services` | Price changes never touch existing bookings (snapshots). |
| POST | `/provider/profiles/{id}/media` ✅ | Multipart `file` (+ `alt`). Owner only (404 otherwise), same-origin, ≤ 50 MB body, 60 uploads/h. Type sniffed from bytes: JPEG/PNG/WebP re-encoded to WebP (≤ 2400 px, metadata stripped), MP4/MOV container-checked. 201 `{ data: { id } }`; 422 `TYPE`/`SIZE`/`LIMIT`/`CORRUPT`; 409 `LOCKED`. |
| — | ordering, card image, alt text, delete | Server Actions in `src/app/[locale]/dashboard/provider/actions.ts` (REST equivalents to follow). |
| GET/PUT | `/provider/profiles/{id}/schedule` | Weekly windows + exceptions. Returns conflicts with confirmed bookings instead of silently changing them. |
| GET | `/provider/bookings` | Filters: profile, status, date range, payment status. |
| POST | `/provider/bookings/{id}/accept` · `/reject` · `/propose` · `/cancel` · `/complete` · `/no-show` | |
| POST | `/provider/bookings/{id}/payments` | Records a received payment (client → provider). |
| GET | `/provider/bookings/{id}/references/{refId}` | Streams a private reference image after ownership check (short-lived signed token). |
| GET | `/provider/analytics?profileId&from&to` | Aggregates; never raw visitor data. |
| GET | `/provider/billing` | Subscription, invoices, payment instructions. |
| POST | `/provider/billing/invoices/{id}/payments` | Manual payment declaration with reference/proof. |
| POST | `/provider/category-requests` · `/provider/support` | |

## Admin (roles: SUPPORT ⊂ ADMIN ⊂ SUPER_ADMIN)

| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/admin/users`, `/admin/users/{id}` | Suspend, restore. Role changes to ADMIN/SUPER_ADMIN: SUPER_ADMIN only. Audited. |
| GET/PATCH | `/admin/providers/{id}` | Approve/reject, verify, add/remove categories, restrict a single profile. Audited. |
| CRUD | `/admin/categories` | Deactivate, reorder, verification requirements, profile field schema. |
| GET/POST | `/admin/pricing` | New price rows apply to future periods only. Audited. |
| GET/PATCH | `/admin/subscriptions/{id}` | Negotiated price, exemption, grace extension. Audited. |
| POST | `/admin/subscription-payments/{id}/verify` | Manual verification, idempotent. Audited. |
| CRUD | `/admin/content/{page}/sections` | Draft, preview token, publish, reorder, hide. |
| GET/PATCH | `/admin/moderation/*` | Reviews, reports, credentials. |
| GET | `/admin/analytics`, `/admin/audit` | |
