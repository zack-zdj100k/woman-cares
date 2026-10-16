# Product requirements

Condensed from the owner's master brief (2026-10-15). The brief is the authority; this file is the
working summary engineers check against. Status lives in [ROADMAP.md](ROADMAP.md).

## Vision

**Woman Cares** brings women's beauty and self-care services in Algeria into one place. Clients
discover professionals near them, see real work, compare services and prices, check real availability
and request appointments. Professionals get a polished online presence, one dashboard for requests,
schedules, capacity, revenue records and visits, across every category they offer. The owner runs the
platform (approvals, categories, pricing, CMS, moderation, analytics) from an Admin dashboard.

Brand line: **"Lady, we care about your beauty."** Copy must be warm and truthful: no invented
testimonials, counts, qualifications or guaranteed results.

## Market

Algeria first: 58 wilayas and their communes, DZD, French (LTR) and Arabic (RTL), `Africa/Algiers`,
mobile first. Architecture stays open to other markets without building for them now.

## Categories

Coiffeuses, Esthétique, Massage, Nails, Extensions de cils, Botox. Botox is regulated: credential
review and admin approval before any profile can be published; admins can restrict it independently.

## Must-haves

1. Premium homepage with the owner's hero film (replaceable asset), search, category showcase,
   featured professionals from real records, how it works, benefits, FAQ, pro CTA, footer, all CMS-editable.
2. Six functional directories with server-side filters (wilaya, commune, nearby with explicit consent,
   distance, price, experience, verified, rating from genuine reviews, date/time, specialties), URL state,
   pagination.
3. One professional account → many category profiles, each with its own services, prices, media,
   schedule, capacity, bookings, status, analytics and billing link.
4. Secure auth for clients and professionals; roles Guest, Client, Provider, Support, Admin, Super Admin,
   enforced on the server.
5. Real booking engine: durations, buffers, breaks, capacity, exceptions, concurrency safety, full state
   machine with history, optional private reference photo, reschedule flow, payment status separate from
   booking status.
6. Provider dashboard (overview, profiles, services, bookings, schedule, analytics, earnings, billing,
   settings, notifications, support), client dashboard (appointments, favorites, profile, reviews,
   notifications), admin dashboard (users, providers, categories, pricing, subscriptions, payments,
   content, moderation, analytics, support, audit, settings).
7. Subscriptions: configurable free trial, then monthly pricing (default 30 000 DZD per billable category,
   never hard-coded), packages, negotiated prices, promotions, exemptions, grace period, publication
   restriction on expiry without deleting data, manual payment verification when no gateway exists.
8. Email (templated HTML + text, retries, dedupe, delivery log) and in-app notifications via an outbox.
9. Security, privacy, performance and tests as described in [SECURITY.md](SECURITY.md) and
   [TEST_PLAN.md](TEST_PLAN.md).

## Decisions taken with sensible defaults (owner may override)

| Topic | Default |
|---|---|
| Pending requests | Hold capacity for 48 h, then `EXPIRED`. |
| Booking window | At least 2 h notice, at most 90 days ahead. |
| Trial / grace | 30 days trial, 7 days grace. |
| Provider location | Approximate (commune) by default; exact address only after an accepted booking if allowed. |
| Search coordinates | Rounded to ~1 km before entering URLs; never stored. |
| Visitor analytics | Unique visitor = one per profile per day per daily-salted hash; raw IPs never stored. |
| Header primary action | "Trouver mon soin" (clients are the primary audience); professionals reach sign-up from "Pour les pros" and pro sections. |
