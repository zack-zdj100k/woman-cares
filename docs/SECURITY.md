# Security model

No system is immune to attack. This document records the layered defences, how they are tested, and
what remains open. Status per control: ✅ in place · 🚧 designed, implementing with its phase.

## Principles

1. The server is the only authority for identity, role, ownership, capacity, subscription state and payment.
2. Least privilege everywhere: database role `woman_cares` owns only its databases; production gets a
   separate migration role and a runtime role without DDL rights.
3. Private by default: client reference photos, credentials and home addresses are never public.
4. Every privileged admin action is written to `AuditLog`.

## Controls

| Threat | Control | Status |
|---|---|---|
| SQL injection | Prisma parameterised queries only; raw SQL limited to reviewed, parameterised `$queryRaw` tagged templates. | ✅ (convention) |
| XSS | React escaping; no `dangerouslySetInnerHTML` for user content; CMS rich text stored as structured JSON and rendered by components; CSP header. | 🚧 CSP in Phase 12 |
| CSRF | `SameSite=Lax` session cookie. All auth mutations are Server Actions, which Next.js only accepts from the same origin. REST mutations will add an `Origin` check. | ✅ (actions) · 🚧 REST |
| Broken access control / IDOR | Pure policy functions in `src/server/policies/roles.ts` (unit-tested); dashboards call `requireArea()`; every provider mutation loads the profile/service/media/closure and checks `provider.userId === session user` (`ownedProfile`); other providers' ids, unknown ids and malformed ids all give the same 404. Restricted/suspended/archived profiles are locked. | ✅ (tested: unit, integration, E2E incl. cross-provider page and upload API) |
| Privilege escalation | Role never read from the client. Only SUPER_ADMIN grants or removes SUPPORT/ADMIN/SUPER_ADMIN; nobody changes their own role; ADMIN cannot suspend staff. Changes are audited and revoke the target's sessions (`src/server/services/admin-users.ts`). | ✅ (tested) |
| Brute force | Sign-in: 30/15 min per IP and 10/15 min per email; 15-minute lockout after 5 consecutive failures. Sign-up 10/h per IP; reset 10/h per IP and 3/h per email; resend 3/h per account. Same error for unknown email and wrong password, with a dummy hash to equalise timing. | ✅ (in-memory limiter; tested lockout) |
| Password storage | scrypt (N=2^15, r=8, p=1, 64-byte key, 16-byte salt), parameters stored per hash so they can be raised. Policy: 10+ chars, letters and digits, not the email's local part (Super Admin: 12+). | ✅ (tested) |
| Session misuse | 256-bit random token in an HTTP-only, `SameSite=Lax`, `Secure` (production/https) cookie; only its SHA-256 is stored; 30-day expiry checked on every request; new session on each sign-in; sign-out deletes the row; password reset, suspension and role changes revoke all sessions; suspended accounts are rejected even with a valid cookie. | ✅ (tested) |
| Malicious uploads | Type detected from magic bytes only (JPEG, PNG, WebP, MP4, MOV); SVG, HTML, PDF, GIF, HEIC rejected. Images re-encoded by sharp to WebP (auto-orient, ≤ 2400 px, 60 MP input cap), which drops EXIF/GPS/ICC and any appended payload. Videos stored as uploaded after a container check. Random UUID keys; user filenames never used; per-profile limits (24 images, 4 videos); public files served with `nosniff` and a sandbox CSP. | ✅ (tested) · videos not transcoded |
| Private media leaks | Separate `private` storage root never served by `/uploads`; keys validated against traversal. Credentials (diplomas, licences) are stored under `credentials/{providerId}/` in private storage and streamed only by `/api/v1/admin/credentials/{id}/file` to ADMIN+ (SUPPORT excluded, least privilege), never cached, PDFs downloaded rather than rendered, every opening audited. Booking example photos are images only (type read from the bytes, re-encoded, EXIF removed), stored under `bookings/{bookingId}/` and streamed by `/api/v1/bookings/{id}/references/{mediaId}` only to the booking's client, her professional and verified staff, never cached. | ✅ separation, credentials and booking photos (tested) |
| Review decisions | Publication, change requests, suspensions, account status, verified badge, category and credential decisions: ADMIN+ only, enforced in `src/server/services/review.ts` (not just hidden buttons). Each decision runs in one transaction with its `AuditLog` row, in-app notification and outbox email. Publication re-checks completeness, the owner's account, and a valid credential for regulated categories at decision time. Refusals and suspensions need a written reason sent to the professional. | ✅ (tested: unit, integration, E2E) |
| Admin users, categories, prices, audit | Every read and change goes through policy functions (`canViewUsers`, `canManageCatalog`, `canViewAudit`, `assignableRoles`, `canChangeRole`, `canChangeStatus`) inside the services, not the pages: SUPPORT reads users, categories and prices; ADMIN+ changes categories and schedules prices; the audit log (reasons, notes, every decision) is ADMIN+ only; clients and providers get the 404 page. Role and status forms only offer what the policy allows, and the server re-checks. Malformed and unknown ids give the same answer as forbidden ones. Price rows are append-only (no update path exists); a new row must start tomorrow or later in Algiers time, so nobody can rewrite what a professional was charged. Suspending, or moving a professional out of the PROVIDER role, hides her public profiles at once (`publicProfileWhere` and the directory SQL require an ACTIVE owner with the PROVIDER role). One Server Action (`manageAction`) parses the form, rate-limits 300 changes per hour per staff member and invalidates the affected cache tags. | ✅ (tested: unit, integration, E2E) |
| SSRF / unsafe links | No server-side fetching of user-supplied URLs. Public social links are filtered to https URLs on known hosts (Instagram, Facebook, TikTok) and open with `rel="noopener noreferrer nofollow"`. | ✅ (tested) |
| Open redirects | `next` accepted only as a same-locale relative path, never `//`, `\\`, schemes or auth pages (`src/lib/auth/redirects.ts`). | ✅ (tested) |
| Resource exhaustion | Directory: fixed page size 12, page ≤ 500, text filters ≤ 80 chars, LIKE wildcards escaped. Contact form: 5 per 15 min per IP and per email (in-memory), honeypot, length limits. Availability ranges ≤ 31 days (Phase 6). | 🚧 shared-store limiter needed for multi-instance |
| Booking race conditions | `SELECT … FOR UPDATE` on the profile row, availability recomputed inside the transaction, request rejected if the exact start is no longer offered; idempotency key per client; 5 open requests per client; only the owning professional can answer, once (conditional update). | ✅ (tested: 5 parallel clients for 2 places) |
| Duplicate payment events | Unique `(gateway, externalId)` on `PaymentEvent`; unique idempotency keys on payments. | ✅ schema |
| Payment manipulation | Amounts computed server-side from price history; browser success pages are never proof of payment. | 🚧 Phase 9 |
| Location privacy | Search coordinates rounded to ~1 km (client and server). Distances use each provider’s public position: exact only for `EXACT`, commune centroid (or ~1 km rounding) for `APPROXIMATE`, commune centroid for `COMMUNE_ONLY`. Public pages show commune and wilaya only; the street address and coordinates never leave the server. | ✅ (integration-tested) |
| Analytics privacy | Visitor hash = HMAC(AUTH_SECRET, day + IP + UA), so hashes cannot be linked across days; raw IPs and full referrer URLs never stored; bots ignored. | ✅ (`src/server/services/analytics.ts`, tested) |
| Secrets | `.env` git-ignored; `.env.example` holds names only; production secrets in the host's secret store. | ✅ |
| Security headers | HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (geolocation=self). | 🚧 Phase 12 |

## Bookings after the request (2026-10-17)

- Every transition is a status-guarded `updateMany` plus a `BookingStatusHistory` row in one transaction; a stale tab gets "this appointment changed meanwhile".
- Proposals and acceptances lock the profile row (`FOR UPDATE`) and recompute availability; a proposed slot is held as busy until the client answers, so nobody else can take it.
- Payments recorded by a professional are locked per booking; a refund cannot exceed the net paid. Woman Cares never collects these payments.
- The client's phone is visible to the professional only while the appointment is live or completed.
- One review per completed booking (unique `bookingId`); ratings validated 1 to 5 on the server.
- Booking actions are rate limited per user (30 per 10 minutes, in memory).

## Account enumeration and email tokens

- Sign-up shows the same "check your email" page whether the address is new or taken; the real owner
  receives an "account exists" notice (at most one per hour).
- "Forgot password" always answers the same way.
- Verification (24 h) and reset (1 h) tokens are 256-bit, stored hashed, single-use (conditional update),
  and a new request invalidates older ones. Verification needs a POST from the page, so mail-client link
  scanners cannot consume it. Token pages send `Referrer-Policy: no-referrer`.

## Email delivery

Emails are written to `OutboxEvent` in the same transaction as the change that causes them, then sent
after the response (`after()`) and by `npm run outbox:deliver` (schedule it every minute). A unique
`EmailDeliveryLog.dedupeKey` prevents double sends; failures retry with backoff (2, 4, 8, 16 min) up to 5
attempts and never roll back the business record. The `log` transport is refused in production.

## Super Admin bootstrap

No default administrator exists. `npm run admin:create -- --email … --name "…"` creates the first
SUPER_ADMIN (password from `SUPER_ADMIN_PASSWORD` or a hidden prompt, 12+ characters), or `--promote`s an
existing verified account. Each run is written to the audit log.

## Payment details (2026-10-22)

The account professionals send their subscription payment to is the most valuable thing an attacker
could change: swapping it redirects real money. It is therefore the most protected setting.

| Threat | Control |
|---|---|
| A non-Super-Admin changes it | `canManageSiteSettings` (verified Super Admin) in the page, the Server Action and the service; the settings page answers 404 to everyone else. Tested for ADMIN, SUPPORT, PROVIDER, CLIENT and an unverified Super Admin. |
| A stolen session cookie (XSS, shared computer) | The Super Admin's password is asked again on every save. Wrong attempts are written to the audit log, so the lock (5 in 15 minutes, per person) holds across servers. |
| The row is edited straight in the database (SQL injection, leaked database credentials) | The value is stored with an HMAC-SHA256 signature keyed from `AUTH_SECRET` (domain-separated). A row that does not verify is never shown; professionals see "unavailable, do not pay", the Super Admins get an alert (at most once a day) and the settings page shows a warning. Saving again restores it. |
| A silent change | Every change is journalled with the old and new value and alerts every Super Admin in the app and by e-mail. Professionals see the date it was last updated. |
| A change in the code | The value lives in the database, not in the code, so a code change does not move it; changing the code needs write access to the repository and a deploy: protect both with two-factor authentication and, on GitHub, branch protection on `main`. |

Rotating `AUTH_SECRET` invalidates the signature: the details are hidden until a Super Admin saves them again. Only professionals (and Super Admins) can read them; they are never on a public page.

## Confirming the e-mail signs her in (2026-10-22)

Owner decision: a click on the confirmation link verifies the address and opens her space, without a second step.

| Risk | Control |
|---|---|
| A mail scanner opens the link and uses up the one-time token | The confirmation stays a POST. The page submits it itself only for a real browser (`navigator.webdriver` is false) after 0.7 s; an automated browser sees the page and leaves the token alone. The button remains for the manual path. Tested both ways. |
| The link becomes a way into any account | It signs in only a client or a professional who has **never signed in** (`lastLoginAt` is empty), whose address is now confirmed and whose account is active. Staff always use their password. The right is claimed with one conditional update, so two clicks cannot both open a session. The token is single use and expires after 24 hours. |
| Someone forwards the e-mail | Same as a password-reset link: whoever holds it before she clicks gets into a just-created account that holds nothing yet. Later confirmations, and any account that has signed in once, go back to the password. |

| The link opens in another browser (the mail app's own) | The browser she signed up in holds `wc_handoff`: httpOnly, HMAC-signed with a key derived from `AUTH_SECRET`, 24 hours, removed once used. Its "check your e-mail" page asks every 4 s (and when she returns to the tab) and is signed in once the account is confirmed. The handoff must be issued within a minute of the account's creation, for a confirmed, active client or professional; never staff. A sign-up with an address that already has an account gets a cookie of the same shape for an id that exists nowhere (no enumeration). Holding the cookie means holding the browser that just chose the password. |

After a first confirmation she lands on her dashboard; a second click, or an account that already signed in, shows the confirmation page and she signs in with her password.

## Payment proofs (2026-10-23)

A professional may attach a proof to her declared transfer (photo, screenshot or PDF, 4 MB at most, the page shrinks photos first). Checked by signature (images re-encoded, which drops metadata; PDFs by `%PDF-`), stored in private storage under `payment-proofs/`, served by `GET /api/v1/billing/payments/{id}/proof` only to the Super Admins (who confirm payments) and to the professional herself, with `no-store`, `nosniff` and a sandboxing CSP. The upload goes through `POST /api/v1/billing/invoices/{id}/declare` (same-origin check, size check before reading, 10 per hour).

Stopping free time (one professional: ADMIN and above; everyone: Super Admin) and sending an invoice (Super Admin) are journalled.

## Production hardening checklist

- **Client IP for rate limits (open, found 2026-10-17):** the app reads the first `X-Forwarded-For` value (`src/lib/auth/session.ts`, contact, availability and view routes). A client that reaches the app directly can send its own header and dodge the per-IP limits on sign-up, sign-in, reset and contact. Before launch: deploy behind a proxy that overwrites the header, and read the address that proxy appends (rightmost trusted hop) behind an explicit `TRUST_PROXY` setting, falling back to the socket address.

- [ ] Separate DB roles (migrate vs runtime); TLS to the database.
- [ ] Security headers and CSP verified with an external scanner.
- [ ] Rate limiter backed by a shared store (not in-memory) when running more than one instance.
- [ ] SPF, DKIM, DMARC for the sending domain.
- [ ] Backups encrypted, restoration tested (see deployment guide, Phase 13).
- [ ] Dependency audit (`npm audit`) reviewed; the scaffold currently reports advisories to triage.
- [ ] Penetration test of auth, booking and admin flows before launch.

## Admin controls added 2026-10-17

- **Deletions** are Super Admin only (`canDelete`), one transaction each, dependants first, with an audit entry holding a short snapshot. Nobody deletes her own account or the last active Super Admin. Categories in use cannot be deleted (deactivate instead). Stored files (portfolio, credentials) stay on disk.
- **Journal entries can be deleted** by Super Admins (owner decision); each deletion writes an `audit.delete` entry, so the journal is no longer strictly append-only.
- **Contact messages** are readable by Super Admins only (`canReadMessages`).
- **Restore after suspension** returns the account to the status recorded in the `user.suspend` audit entry.
- **Password change** requires the current password, signs out every other session and sends the security email.
- **Prices** may start on any day from 2020; invoices keep a frozen copy of the price they were issued with.

## Calendar, contacts and receipts (2026-10-18)

- **Manual bookings** store the client's name and phone typed by the professional (`guestName`, `guestPhone`) with no account; a CHECK constraint requires an account or a name. Only the owning professional sees them.
- **Moves and agreed prices** are direct (owner decision): status-guarded, written to the booking history, and the client with an account is emailed and notified.
- **Avatars** are public files: sniffed, cropped to 256 px, re-encoded to WebP (metadata removed); the previous file is deleted.
- **Receipts** are private files (PDF kept as is, images re-encoded), readable by staff and by the professional the payment belongs to; downloads are `no-store`, sandboxed, attachment.
- **Google Maps links** are accepted only from Google hosts (`maps.app.goo.gl`, `goo.gl`, `maps.google.com`, `google.*/maps`) over https; WhatsApp numbers must be Algerian.
- **Email confirmed by staff** (ADMIN+) is audited (`user.email.confirm`).
