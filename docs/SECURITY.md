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
| Private media leaks | Separate `private` storage root never served by `/uploads`; keys validated against traversal. Authorised streaming routes arrive with booking references and credentials. | ✅ separation · 🚧 streaming routes |
| SSRF / unsafe links | No server-side fetching of user-supplied URLs. Public social links are filtered to https URLs on known hosts (Instagram, Facebook, TikTok) and open with `rel="noopener noreferrer nofollow"`. | ✅ (tested) |
| Open redirects | `next` accepted only as a same-locale relative path, never `//`, `\\`, schemes or auth pages (`src/lib/auth/redirects.ts`). | ✅ (tested) |
| Resource exhaustion | Directory: fixed page size 12, page ≤ 500, text filters ≤ 80 chars, LIKE wildcards escaped. Contact form: 5 per 15 min per IP and per email (in-memory), honeypot, length limits. Availability ranges ≤ 31 days (Phase 6). | 🚧 shared-store limiter needed for multi-instance |
| Booking race conditions | Row lock on the profile + capacity recount inside the transaction; idempotency keys. | 🚧 Phase 6 |
| Duplicate payment events | Unique `(gateway, externalId)` on `PaymentEvent`; unique idempotency keys on payments. | ✅ schema |
| Payment manipulation | Amounts computed server-side from price history; browser success pages are never proof of payment. | 🚧 Phase 9 |
| Location privacy | Search coordinates rounded to ~1 km (client and server). Distances use each provider’s public position: exact only for `EXACT`, commune centroid (or ~1 km rounding) for `APPROXIMATE`, commune centroid for `COMMUNE_ONLY`. Public pages show commune and wilaya only; the street address and coordinates never leave the server. | ✅ (integration-tested) |
| Analytics privacy | Visitor hash = HMAC(AUTH_SECRET, day + IP + UA), so hashes cannot be linked across days; raw IPs and full referrer URLs never stored; bots ignored. | ✅ (`src/server/services/analytics.ts`, tested) |
| Secrets | `.env` git-ignored; `.env.example` holds names only; production secrets in the host's secret store. | ✅ |
| Security headers | HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (geolocation=self). | 🚧 Phase 12 |

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

## Production hardening checklist

- [ ] Separate DB roles (migrate vs runtime); TLS to the database.
- [ ] Security headers and CSP verified with an external scanner.
- [ ] Rate limiter backed by a shared store (not in-memory) when running more than one instance.
- [ ] SPF, DKIM, DMARC for the sending domain.
- [ ] Backups encrypted, restoration tested (see deployment guide, Phase 13).
- [ ] Dependency audit (`npm audit`) reviewed; the scaffold currently reports advisories to triage.
- [ ] Penetration test of auth, booking and admin flows before launch.
