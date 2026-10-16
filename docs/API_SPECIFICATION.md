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
| GET | `/profiles/{slug}/availability?serviceId&from&days` ✅ | Free start times for one active service of a public profile, 1-14 days from `from` (default today), horizon 60 days. `{ data: [{ date, weekday, slots: [{ startAt, minute, remaining }] }] }`, `no-store`, 120/min per IP, 404 for unknown or private profiles. Display only; the request re-checks. |
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
| POST | `/bookings` | `profileId`, `serviceId`, `startAt`, `note?`, `Idempotency-Key`. Transactional capacity check. Today a Server Action (`requestBookingAction` in `src/app/[locale]/booking/actions.ts`): verified clients only, 10 per 10 min, at most 5 open requests, profile row locked while capacity is recounted; errors `slot`, `limit`, `profile`, `service`, `role`, `verify`, `signin`, `rate`. |
| POST | `/bookings/{id}/references` | Multipart image ≤ 8 MB (JPEG/PNG/WebP/HEIC, magic-byte checked). Private. |
| GET | `/me/bookings` · `/me/bookings/{id}` | Own bookings only. |
| POST | `/me/bookings/{id}/cancel` · `/accept-reschedule` · `/decline-reschedule` | State machine enforced. |
| GET/PUT/DELETE | `/me/favorites/{profileId}` | |
| POST | `/me/bookings/{id}/review` | Only `COMPLETED`, once. |
| GET/PATCH | `/me/notifications` | |
| PATCH | `/me` | Profile, locale, preferred wilaya, notification preferences. |

| PATCH | `/bookings/{id}` (client) | Cancel before the start (`reason?`), accept or decline a proposed time, review a completed visit (`rating` 1-5, `comment?`). Today Server Actions `clientCancelAction`, `answerProposalAction`, `reviewAction` (`src/app/[locale]/dashboard/booking-actions.ts`) over `src/server/services/booking-lifecycle.ts`; errors `state`, `slot`, `service`, `forbidden`. |

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
| POST | `/provider/credentials` ✅ | Multipart `file`, `category`, `type` (diploma, training, license, other), optional `issuer`, `expiresAt`. Same-origin, ≤ 10 MB, 20 per hour, 12 per account. Only for categories with a pending request or an existing profile. PDF (header checked) stored as uploaded; JPEG/PNG/WebP re-encoded (metadata stripped). Private storage only. 201 `{ data: { id } }`; 422 `TYPE`/`SIZE`/`LIMIT`/`CORRUPT`; 404 `NOT_FOUND`; 409 `LOCKED`. |

| PATCH | `/provider/bookings/{id}` | Accept/decline (`respondBookingAction`), propose a free time (`proposeTimeAction`, free times from `freeSlotsAction`), cancel with a required reason, complete or no-show after the start (`closeVisitAction`), record a payment or refund (`visitPaymentAction`: `amount`, `method` cash/transfer/ccp/baridimob/card, `refund?`, `note?`). Ownership and status are re-checked in each write. Rate limit 30 per 10 minutes. |

## Admin (roles: SUPPORT ⊂ ADMIN ⊂ SUPER_ADMIN)

| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/admin/users`, `/admin/users/{id}` | List (`q` on name/email, `role`, `status`, `page`, 25 per page) and detail: SUPPORT+. Suspend (reason ≥ 10 characters, from ACTIVE or PENDING_VERIFICATION) and restore (from SUSPENDED, back to ACTIVE or PENDING_VERIFICATION when the email was never confirmed): ADMIN+ for clients and professionals, SUPER_ADMIN for staff. Role changes: ADMIN moves CLIENT ↔ PROVIDER only; anything touching SUPPORT/ADMIN/SUPER_ADMIN is SUPER_ADMIN only; nobody changes their own role. Both revoke the target's sessions, write `user.role.change` / `user.suspend` / `user.restore`, and refresh the public pages of a professional's profiles (a suspended or demoted professional is hidden). Today: Server Action `manageAction` (`src/app/[locale]/dashboard/admin/manage-actions.ts`) over `src/server/services/admin-users.ts`. |
| GET/PATCH | `/admin/providers/{id}` | Approve/reject, verify, add/remove categories, restrict a single profile. Audited. Today these decisions are Server Actions (`src/app/[locale]/dashboard/admin/actions.ts`) over `src/server/services/review.ts`; the REST routes will wrap the same services. |
| GET | `/admin/credentials/{id}/file` ✅ | ADMIN+ only (404 otherwise, same as unknown ids). Streams the private document; PDFs as attachments, photos inline; `Cache-Control: private, no-store`, `nosniff`, sandbox CSP, `Referrer-Policy: no-referrer`. Each opening writes `credential.view` to the audit log. |
| CRUD | `/admin/categories` | List: SUPPORT+. Activate/deactivate, move up/down (renumbered 1..n under a row lock), require/waive credential review: ADMIN+, audited (`category.activate`, `category.deactivate`, `category.reorder`, `category.credentials.require`, `category.credentials.waive`). Deactivation hides every profile of the category (public queries require an active category) and invalidates `profiles`, `pricing` and `directory:<slug>`. Profile field schema: not yet. Today: `manageAction` over `src/server/services/admin-categories.ts`. |
| GET/POST | `/admin/pricing` | GET (SUPPORT+): per category the price in effect, the next change and the full history with states (in effect, upcoming, past, replaced). POST (ADMIN+): `{ categoryId, price, day }`, whole dinars 1..1 000 000, `day` from tomorrow to two years ahead (Algiers calendar); the row starts at 00:00 Africa/Algiers. Rows are never edited; a second row for the same day replaces the first (latest created wins). Audited as `subscription.price.schedule`; invalidates `pricing`. The public price list (`getPublicPricing`) reads the row in effect on today's Algiers date, keyed by day in the cache so the switch happens at midnight. Today: `manageAction` over `src/server/services/admin-pricing.ts`. |
| GET/PATCH | `/admin/subscriptions/{id}` | Negotiated price, exemption, grace extension. Audited. |
| POST | `/admin/subscription-payments/{id}/verify` | Manual verification, idempotent. Audited. |
| CRUD | `/admin/content/{page}/sections` | Draft, preview token, publish, reorder, hide. |
| GET/PATCH | `/admin/moderation/*` | Reviews, reports, credentials. |
| GET | `/admin/audit` | ADMIN+ only. Filters: `action`, `actor` (user id or `system`), `entity` (entity type), `from`/`to` (Algiers days, inclusive), `page` (50 per page), newest first. Read-only; filter menus list only values present in the log. Today: page `/dashboard/admin/audit` over `src/server/services/audit.ts`. |
| GET | `/admin/analytics` | |
