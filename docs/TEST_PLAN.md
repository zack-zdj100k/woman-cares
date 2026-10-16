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
admin price change applies to future periods only · payment idempotency · outbox: email failure leaves
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
