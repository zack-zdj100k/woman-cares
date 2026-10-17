# Data mapping (dashboard numbers)

Where every dashboard figure comes from. Nothing is invented or estimated; an empty state is shown
when there is no data. Times use Africa/Algiers; weeks start on Saturday.

| Screen | Figure | Source |
|---|---|---|
| Professional overview | Bookings in period (+ delta) | `Booking.startAt` in period, her profiles, optional category |
| | Requests to handle | `Booking.status = PENDING` |
| | Revenue recorded | `BookingPayment` PAID minus REFUNDED, `recordedAt` in period (what she recorded; Woman Cares does not take payments) |
| | Profile views, conversion | `ProfileViewEvent` (one per visitor per day) ; requests created / views |
| | Weekly chart | Requests by `createdAt` week, views by `day` week, last 8 weeks |
| Professional calendar | Appointments, hours, closures | `Booking` (PENDING, ACCEPTED, RESCHEDULE_PROPOSED, COMPLETED, NO_SHOW) overlapping the Algiers week; `WorkingSchedule`; `ScheduleException` |
| Professional earnings | Net, paid, refunded, average | `BookingPayment` by `recordedAt` in period: PAID sum, REFUNDED sum, net = difference, average = paid / number of PAID rows |
| | Unpaid visits | `Booking` COMPLETED with `paymentStatus = UNPAID` (indicative price snapshot shown, never counted as revenue) |
| | 12-month chart, by category, by method | Same rows grouped by Algiers month, profile category, `method` |
| Professional analytics | Funnel | Views (`ProfileViewEvent`), requests (`Booking.createdAt` in period), answered and accepted (history PENDING → ACCEPTED/REJECTED), completed (`startAt` in period) |
| | Rates | request = requests / views; acceptance = accepted / answered; expiry = EXPIRED / requests; no-show = NO_SHOW / (COMPLETED + NO_SHOW); cancellation = cancelled / (completed + no-show + cancelled). `null` ("not enough data") when the divisor is 0 |
| | Busy times | Algiers weekday and starting hour of ACCEPTED, COMPLETED, NO_SHOW appointments in period |
| Professional bookings | Counts per tab | Same filters as the table (`listProviderBookingTable`) |
| | Payment column | `Booking.paymentStatus`, derived from `BookingPayment` rows |
| Client overview | Upcoming / awaiting / completed / favorites | `Booking` by status for her, `Favorite` |
| Admin overview | Clients, professional accounts, published profiles, bookings this month | `User.role`, `ProviderAccount`, `ProviderServiceProfile.status = PUBLISHED`, `Booking.startAt` |
| Admin billing | Invoices, payments to verify | `Invoice`, `SubscriptionPayment.status = PENDING` |
| Subscription amounts | Monthly price | `CategorySubscriptionPricing` in force (per category) or the agreed monthly price on `ProviderSubscription` |
| Shell badges | Unread, pending, proposals, queue, payments | `Notification.readAt`, `Booking` statuses, review queue counts, `SubscriptionPayment` |
