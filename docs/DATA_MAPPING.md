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
| Professional bookings | Counts per tab | Same filters as the table (`listProviderBookingTable`) |
| | Payment column | `Booking.paymentStatus`, derived from `BookingPayment` rows |
| Client overview | Upcoming / awaiting / completed / favorites | `Booking` by status for her, `Favorite` |
| Admin overview | Clients, professional accounts, published profiles, bookings this month | `User.role`, `ProviderAccount`, `ProviderServiceProfile.status = PUBLISHED`, `Booking.startAt` |
| Admin billing | Invoices, payments to verify | `Invoice`, `SubscriptionPayment.status = PENDING` |
| Subscription amounts | Monthly price | `CategorySubscriptionPricing` in force (per category) or the agreed monthly price on `ProviderSubscription` |
| Shell badges | Unread, pending, proposals, queue, payments | `Notification.readAt`, `Booking` statuses, review queue counts, `SubscriptionPayment` |
