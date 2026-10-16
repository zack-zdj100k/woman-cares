# User journeys (dashboards)

Narrative flows with diagrams: [../USER_FLOWS.md](../USER_FLOWS.md). Booking states:
[booking-state-machine.mmd](booking-state-machine.mmd).

1. **Client books and manages.** Profile → slot → request → *Mes rendez-vous* → detail: cancel before
   the start, or accept / keep the original time when the professional proposes another one → after
   the visit, leave one review.
2. **Professional runs her day.** Overview (category switcher) → *Rendez-vous* "À traiter" → open →
   accept, decline, or propose a free time → on the day, "Aujourd’hui" → after the visit, mark done or
   absent → record what the client paid (or a refund).
3. **Admin bills a professional.** *Professionnelles* → file → *Prix de l’abonnement*: standard,
   agreed monthly price with a reason, or exemption → next invoice uses it → professional declares a
   transfer → *Paiements* → verify or refuse → visibility follows the subscription status.
4. **Daily job.** `npm run daily`: expire unanswered requests, run the billing cycle, send emails.
