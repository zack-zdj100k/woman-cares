# Permissions

The matrix lives in [architecture/permissions-matrix.md](architecture/permissions-matrix.md).
Rules behind it:

1. **The server decides.** Every Server Action and route handler loads the session user and calls a
   policy or an ownership check before touching data. Pages call `requireArea`.
2. **Ownership is part of the query.** Professionals reach bookings through `providerId` of their own
   account; clients through `clientId`. A booking id from another account returns "not found".
3. **State is checked at write time.** Booking transitions are `updateMany` guarded by the expected
   status, so a stale tab cannot overwrite a newer decision (`src/server/services/booking-lifecycle.ts`).
4. **Contact details are need-to-know.** The client's phone is shown to the professional only while
   the booking is confirmed, waiting on a proposal, or completed.
5. **Staff ranks.** SUPPORT reads; ADMIN decides; SUPER_ADMIN also manages staff. Nobody changes her
   own role or status.
6. **Audit.** Staff decisions, price and billing changes and credential file openings write `AuditLog`.
