# Dashboards specification

Source: the owner's "Complete Dashboards Master Prompt" (2026-10-16). This file records the business
rules and the decisions taken to implement it. Route status lives in
[DASHBOARD_SITE_MAP.md](DASHBOARD_SITE_MAP.md), permissions in
[DASHBOARD_PERMISSIONS.md](DASHBOARD_PERMISSIONS.md), page-to-data wiring in
[DASHBOARD_DATA_MAPPING.md](DASHBOARD_DATA_MAPPING.md), progress in
[DASHBOARD_ROADMAP.md](DASHBOARD_ROADMAP.md).

## Three dashboards, one shell

| Dashboard | Users | Character |
|---|---|---|
| Client | `CLIENT` | Welcoming and simple: what needs her attention first. |
| Professional | `PROVIDER` (one account, many category profiles) | A beauty-business tool: bookings, calendar, portfolio, money. |
| Admin | `SUPPORT` ⊂ `ADMIN` ⊂ `SUPER_ADMIN` | Operational: dense tables, safe controls, audit trail. |

All three share one application shell (`src/components/dashboard/shell/*`), following the owner's
"app-1" reference in **black**: a collapsible sidebar (drawer on phones, mirrored in Arabic), a top bar
with the page title, search where useful, notification bell with unread count, language switch and the
account menu. The public website stays light (floral parchment); dashboards are a dark workspace
(`.dashboard-dark` tokens), a deliberate split decided by the owner.

## Business rules (binding)

- One professional account owns many category profiles (`ProviderAccount` 1→n `ProviderServiceProfile`),
  each with its own services, media, schedule, bookings, publication and verification state.
- The professional dashboard shows **All categories** (labelled aggregates) or **one category**
  (only that profile's records). The selection is kept in the URL (`?category=nails`) so it survives
  navigation between modules.
- Booking status and payment status are separate fields and separate histories.
- Nothing financial or historical is hard-deleted. Removing a category archives the profile.
- Prices are snapshotted: bookings keep the service price at request time, invoices keep the
  subscription price at issue time.
- Every permission is enforced on the server (policies in `src/server/policies/roles.ts`); the UI only
  hides what the server would refuse anyway.
- Emails go through the transactional outbox; a failed email never rolls back the business change.
- French (LTR) and Arabic (RTL) everywhere; French copy uses ’ and no em dashes.

## Subscriptions and billing model

Prices, trial and grace come from the database, never from code.

| Basis (`BillingBasis`) | Monthly amount | Set by |
|---|---|---|
| `PER_CATEGORY` (default) | Sum, for each billable category profile, of the category price in effect (`CategorySubscriptionPricing`, default 30 000 DZD) | Category prices: Admin › Tarifs |
| `NEGOTIATED` | One monthly amount agreed with this professional, whatever her number of categories | Admin › Professionnelles › Abonnement |
| `PACKAGE` | The plan's package price, up to its maximum number of categories | Admin › Formules |
| `EXEMPT` | 0, with a written reason; no invoices | Admin › Professionnelles › Abonnement |

- **Billable category profile:** a profile that is `PUBLISHED`, or `PENDING_REVIEW` after having been
  published once, and not archived.
- **Lifecycle (`SubscriptionStatus`):** `TRIALING` (from account approval, `trialDays` of the plan) →
  first invoice at trial end → `ACTIVE` when paid → `PAST_DUE` after the due date → `GRACE` until
  `graceEndsAt` (`graceDays`) → `EXPIRED`: profiles leave the directory (`billingVisible = false`), the
  professional keeps her account, history, invoices and support. Paying a pending invoice reactivates.
  `EXEMPT` never invoices. `SUSPENDED`/`CANCELLED` are admin decisions.
- **Invoices** are issued per period with one line per billable category (or one negotiated/package line),
  a JSON snapshot of the pricing basis, and are never edited after issue. Corrections are new audited
  records (void + reissue).
- **Payments without a gateway:** the professional declares a transfer (CCP, BaridiMob, bank transfer,
  cash at an office) with a reference and an optional private proof; an Admin verifies it. Only a verified
  payment marks an invoice paid. A client-side button is never proof of payment.
- **The billing cycle** (`runBillingCycle`) is idempotent: it issues due invoices (unique per subscription
  and period), moves statuses with time and recomputes directory visibility. It runs from
  `npm run billing:cycle` (schedule daily in production) and is safe to run twice.

## Financial definitions (professional dashboard)

| Term | Definition |
|---|---|
| Bookings | Distinct booking rows whose start falls in the period (Algiers calendar). Rescheduling keeps one row. |
| Completed bookings | Bookings with status `COMPLETED` in the period. |
| Cancellation rate | (`CANCELLED_BY_CLIENT` + `CANCELLED_BY_PROVIDER`) ÷ bookings that were accepted at least once. |
| Recorded revenue | Sum of `BookingPayment.amount` with status `PAID`, recorded in the period, minus `REFUNDED` amounts. Gross, as recorded by the professional; never called profit. |
| Outstanding | For completed bookings: agreed price (or the minimum price snapshot) minus recorded paid amounts, when positive. |
| Profile views | Rows of `ProfileViewEvent` (one per visitor per profile per day; see analytics privacy). |
| Unique visitors | Distinct daily visitor hashes in the period. Hashes rotate daily, so a returning visitor on two days counts twice; documented limitation. |
| Conversion | Booking requests created in the period ÷ profile views in the same period, same profile. Not attribution-exact: a request may follow a view from an earlier period. |
| Net profit | Not shown: no costs are recorded. |

Platform revenue (Admin) is the sum of **verified** `SubscriptionPayment` amounts. It is never mixed
with client-to-professional service revenue.

## Time

All periods use the `Africa/Algiers` calendar (UTC+1, no daylight saving). Weeks start on Saturday.

## Decisions recorded

| Decision | Why |
|---|---|
| Dashboards in a dark theme, website light | Owner's request ("app-1" design in black). |
| shadcn-style primitives live in `src/components/ui/` with `cn` from `src/lib/utils.ts` (clsx + tailwind-merge) | The owner's components expect that structure; the older `src/lib/cn.ts` stays for existing code. |
| Server Actions for dashboard mutations, REST under `/api/v1` for public reads, uploads and integrations | Same business services behind both; Server Actions are same-origin by construction. REST wrappers are added per module when an external client needs them. |
| Negotiated price is one monthly amount per professional | The owner asked to set "her price"; a per-category negotiated grid can be added later without schema change (`SubscriptionItem.priceSnapshot`). |
| Admin audit route kept at `/dashboard/admin/audit-logs` | Matches the specification's route list. |
