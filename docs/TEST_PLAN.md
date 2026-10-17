# Test plan

| Layer | Tool | Location | Command |
|---|---|---|---|
| Unit | Vitest | `tests/unit` | `npm run test` |
| Integration (real PostgreSQL, `TEST_DATABASE_URL`; migrations and reference seed applied automatically) | Vitest | `tests/integration` | `npm run test:integration` |
| End-to-end (production build on port 3100, `TEST_DATABASE_URL`; reads emailed links from the outbox) | Playwright | `tests/e2e` | `npm run test:e2e` (set `CHROMIUM_PATH` or run `npx playwright install chromium` first) |
| Visual QA | Playwright scripts | `scripts/hero-shots.mjs`, `scripts/page-shot.mjs` | see below |
| Static | `tsc`, ESLint | | `npm run typecheck`, `npm run lint` |

## Unit (written with each phase)

Authorization policies · multi-category account rules · pricing and invoice computation · subscription
transitions · booking state machine · slot generation (durations, buffers, split shifts, exceptions,
capacity) · distance (haversine) · analytics formulas · upload validation · locale/currency formatting.

## Integration

Auth and resource ownership per role · profile creation across several categories on one account ·
booking create/accept/cancel/reschedule · **concurrent booking attempts on the last seat** (N parallel
transactions, exactly `capacity` succeed) · subscription expiry hides profiles without deleting data ·
admin price change applies to future periods only (✅ `tests/integration/admin.test.ts`) · payment idempotency · outbox: email failure leaves
the booking intact · private media access denied to other users.

## End-to-end journeys (Playwright)

1. Visitor opens the homepage and visits all six directories.
2. Client registers and verifies the account (email captured by the `log` transport).
3. Client filters providers by location.
4. Client opens a profile and submits a request.
5. Client attaches a private reference picture.
6. Provider receives and accepts it.
7. Both dashboards show the same state.
8. Provider adds a category to the same account.
9. Provider changes the schedule; availability updates.
10. Subscription expiry restricts publication.
11. Admin changes a category price.
12. Unauthorised users cannot reach admin pages or APIs.
13. A provider cannot read another provider's bookings.
14. A client cannot read another client's data.
15. Email failure does not corrupt the booking.

## Visual QA protocol

Widths 375, 768, 1440; French and Arabic; light and dark; reduced motion.

```bash
export CHROMIUM_PATH="$(find ~/Library/Caches/ms-playwright -name 'Google Chrome for Testing' -type f -path '*MacOS*' | head -1)"
node scripts/hero-shots.mjs http://localhost:3000/fr 1440 900 .playwright-mcp/d-hero 0,0.4,0.85
node scripts/page-shot.mjs http://localhost:3000/fr 375 812 .playwright-mcp/m-full.jpg
node scripts/console-check.mjs http://localhost:3000/fr/coiffeuses 375
```

### Verified (2026-10-17, dashboard navigation speed)

- Measured on a production build with Playwright (CPU profile, timers, network): sidebar clicks took about 840 ms while the server answered in 9-80 ms; the cause was a page-level Suspense skeleton plus React's 300 ms reveal throttle. After removing page-level boundaries: 116-150 ms (professional), 55-133 ms (admin).
- Lint, 99 unit, 103 integration, 16 end-to-end tests pass after the change.

### Verified (2026-10-17, calendar, earnings, analytics)

- Unit: 99 tests, adding insights (rates return null without data, Algiers clock, weekday and hour histograms, 12 months across a year boundary, side-by-side layout of overlapping appointments).
- Integration: 103 tests, adding provider-insights (net of refunds, by method and category, unpaid visits, category fallback, ownership and role refusal, null rates then real ones, week starting Saturday with hours). The tests move visits 2 hours into the past, so in the first 2 hours of a month (Algiers) the "this month" figures would legitimately be empty.
- Screenshots: calendar, earnings and analytics at 375/768/1440 in FR and AR; one overflow found on analytics (table wrapper) and fixed.

### Verified (2026-10-17, dashboards, billing engine, booking lifecycle)

- Type check, ESLint, production build: clean.
- Unit: 94 tests, adding billing (invoice lines, statuses, visibility) and booking rules (who may act when, payment sums, strict amounts).
- Integration: 99 tests, adding billing (trial, invoices once per period, agreed price, exemption, verification, grace and expiry) and booking lifecycle (cancellations, reschedule holding both slots and refusing taken ones, decline back to the previous state, completion, payments and refunds, one review, no-show hides the phone, expiry once, table filters and ownership).
- End-to-end: 16 tests, adding billing (admin sets an agreed monthly price; the professional sees her trial) and the booking journey through the new tables (accept in the booking detail, client cancels from her appointment). One run had the Botox spec time out under load; it passed alone and in the previous full run.
- Screenshots: provider overview and bookings at 375/768/1440 in FR and AR, no horizontal overflow. Not covered: client appointment pages with real rows (the dev database has no client or booking, and none are invented); they are exercised by the e2e journey.

### Verified (2026-10-16, booking core and visual redesign)

- Unit: 73 tests, adding slot generation (Algiers time, 15-minute grid, closed and open exceptions, buffers on both sides, capacity, notice period).
- Integration: 66 tests, adding availability, a full request (history, notifications, two emails, place taken), idempotent repeats, 5 clients racing for 2 places (exactly 2 succeed), role/verification/off-grid/unknown-service refusals, the 5-open-requests cap, accept by the owner only and once, decline frees the place.
- End-to-end: 13 tests, adding the booking journey (profile published by staff, guest picks a time, signs in, choice restored, sends with a note, professional accepts, client sees “Confirmé”).
- Overflow sweep: 7 pages x FR/AR x 390/768 px, and screenshots at 375/768/1440, with no horizontal scroll.

### Verified (2026-10-16, Phase 10 second slice: users, categories, pricing, audit)

- Unit: 81 tests, adding admin policies (who reads users/catalog, who changes them, audit ADMIN+, assignable roles incl. never one's own, suspendable states) and price dates (Algiers day boundaries, tomorrow-to-two-years rule, whole-dinar parsing, current/upcoming/past/replaced states).
- Integration: 84 tests, adding SUPPORT read-only and client/provider refusals on every admin service; user search, role and status filters, pagination; staff roles only by SUPER_ADMIN, never on oneself, audited; a professional moved to CLIENT or suspended disappears from the directory, profile, provider and featured queries and comes back on restore (cache tags returned); unverified accounts restored to PENDING_VERIFICATION; category deactivation hiding profiles and the price, reorder renumbering with end refusals, credential toggle, each audited; price rows refused for today, the past, bad amounts and unknown categories, created at Algiers midnight, audited, never altering existing rows; the public price switching exactly at 00:00 Algiers with same-day correction winning; audit filters (action, actor, system, entity, inclusive Algiers dates) and pagination.
- End-to-end: 15 tests, adding a CLI-created Super Admin scheduling a nails price (announced, listed as upcoming in the history, a past date refused by the server, found in the audit log with readable details) and a signed-in client getting the not-found page on users, categories, pricing and audit.
- Screenshots of users, user file, categories, pricing and audit at 375/768/1440 in FR and AR (dev database, temporary session removed afterwards): no horizontal overflow.

### Verified (2026-10-16, Phase 10 first slice: review queue)

- Unit: 66 tests, adding review policies (who reads the queue, who decides, what can be published).
- Integration: 57 tests, adding SUPPORT read-only and provider refusal on every review operation, queue filters/search/counts, publication into the directory with account approval, audit, notification and outbox email, incomplete profile and unverified owner refusals, change requests (note required, back to DRAFT), profile and account suspension hiding profiles and reinstatement, verified badge, Botox: PDF header detection, uploads limited to requested categories and stored privately (absent from the public root), ADMIN-only audited file access, expired or revoked credentials blocking both the request and publication, rejection notes.
- End-to-end: 12 tests, adding a professional's submitted profile published by a CLI-created Super Admin and then visible in `/fr/nails`, and a Botox credential upload: the request is refused before validation, the file is served `no-store` as an attachment to staff and 404 to the professional, then validation and acceptance create the Botox draft.
- Screenshots of the overview, queue and review page at 375/768/1440 in FR and AR (no horizontal overflow).

### Verified (2026-10-16, Phase 4)

- Unit: 63 tests, adding magic-byte sniffing, image re-encoding (EXIF/GPS stripped, orientation applied, 2400 px cap, corrupt files rejected), schedule/closure/service/profile/settings validation, editing policies, Algiers time helpers.
- Integration: 43 tests, adding cross-provider isolation for every operation, specialty filtering, automatic starting price, history-safe service deletion with booking snapshots intact, schedule replacement and booking-conflict confirmation, closures, media storage/order/card image/deletion, submission checklist and audit, restricted-profile lock, categories on one account (Botox request, archive and restore).
- End-to-end: 10 tests, adding a professional completing every editor section (real upload) and sending for review, and a second professional refused on the first one's editor page and upload API.
- `scripts/page-shot.mjs` accepts `SESSION_TOKEN` to capture signed-in pages in development.

### Verified (Phase 3)

- Unit: 49 tests, adding role policies (areas, privilege changes, ownership, bookings), open-redirect guard, scrypt hashing, password policy, tokens, phone normalisation, sign-up schemas, email template escaping and RTL.
- Integration: 29 tests, adding sign-up (client, duplicate, multi-category professional), sign-in and lockout, sessions (valid, expired, unknown, suspended), single-use verification, password reset (session revocation, old link invalidation), outbox delivery and retry on SMTP failure, audited role and status changes.
- End-to-end: 8 tests: dashboard redirect with return path; client sign-up → email link → confirm → sign-in → dashboard → admin/provider areas refused → sign-out; professional sign-up with draft profiles and pending Botox; generic sign-in error; Arabic RTL; Super Admin via CLI reaches admin; no horizontal overflow on phones.
- Browser walkthrough in development of every auth flow, including password reset (old password refused afterwards).

### Verified (Phase 2)

- `npm test`: 19 unit tests (directory query parsing, URL building, LIKE escaping, weekday maths, reviewer names, social-link filtering, weekly hours, visitor hashing, Algiers day, bot filter, hero timing).
- `npm run test:integration`: 12 tests on PostgreSQL (visibility rules, every directory filter, opening-day closures, review aggregation, distance from public positions, no address or coordinate leaks, provider page, view de-duplication).
- Browser: contact form validation keeps typed values, valid submission stored; directory filter form submits clean URLs; locale switch keeps the current page.
- Screenshots FR/AR at 375/768/1440 for directory, profile, about, pros and contact pages; no horizontal overflow.

### Verified earlier (homepage)

- Homepage hero at 375/768/1440, FR and AR: no horizontal overflow; frame opens on scroll; each scroll
  quarter seeks its chapter and that chapter loops while the visitor stays on it; intro hands over to the
  chapter title (opacities measured at 30/55/85 % progress).
- Lower homepage sections at 1440 and 375.
- Not yet verified: dark mode visual pass, reduced-motion visual pass, real devices (iOS Safari autoplay).
