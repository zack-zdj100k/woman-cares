# Dashboard modules

Which module exists, what it reads and writes, and how it is verified. Routes: ../DASHBOARD_SITE_MAP.md.

| Area | Module | Service (src/server/services) | Writes | Tests |
|---|---|---|---|---|
| Shared | Shell, sidebar, badges | dashboard-shell.ts | none | e2e (every dashboard spec) |
| Shared | Notifications | notifications.ts | `Notification.readAt` | e2e flows |
| Client | Overview | client-overview.ts | none | screenshots |
| Client | Appointments + detail | bookings.ts, booking-views.ts, booking-lifecycle.ts | cancel, answer proposal, review | integration booking-lifecycle, e2e booking |
| Professional | Overview | provider-overview.ts | none | screenshots |
| Professional | Bookings table + detail | booking-views.ts, booking-lifecycle.ts | respond, propose, cancel, complete, no-show, payments | integration booking + booking-lifecycle, unit booking-rules, e2e booking |
| Professional | Profiles, services, schedule, settings | provider-*.ts | profile data | integration provider, e2e provider |
| Professional | Subscription, invoices | billing.ts | payment declaration | integration billing |
| Admin | Overview | admin-overview.ts | none | screenshots |
| Admin | Review queue | review.ts | decisions (audited) | integration review, e2e review |
| Admin | Users, categories, pricing, audit | admin-*.ts | audited changes | integration admin, e2e admin |
| Admin | Subscriptions, invoices, payments | billing.ts | terms, verification, cycle (audited) | unit + integration billing |

Planned modules (not in the sidebar): client favorites, reviews, profile, support; professional
calendar, earnings, analytics, support; admin bookings, CMS, moderation, support inbox, analytics,
settings.
