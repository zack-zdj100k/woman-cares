# User flows

## Client: discover and request

```mermaid
flowchart TD
    A[Home or category page] --> B[Trouver mon soin dialog]
    B -->|category + wilaya / commune| D[Directory with filters]
    B -->|Autour de moi: explicit consent| C{Geolocation allowed?}
    C -->|yes, rounded ~1 km| D
    C -->|no / unavailable| B2[Message + pick a wilaya] --> D
    D --> E[Provider card] --> F[Category profile]
    F --> G[Choose service] --> H[Day strip: next 14 days] --> I[Time bars: free starts only]
    I --> J[Optional note]
    J --> K[Summary: service, day, time]
    K --> L{Signed in?}
    L -->|no| M[Sign in, return to the profile with the same choice] --> K
    L -->|yes| N[Submit request: PENDING, capacity held]
    N --> O[Email + in-app to provider]
    O --> P{Provider decision}
    P -->|accept| Q[ACCEPTED: both dashboards and agenda]
    P -->|reject| R[REJECTED: client notified]
    P -->|propose time| S[RESCHEDULE_PROPOSED] --> T{Client}
    T -->|accept| Q
    T -->|decline| U[CANCELLED_BY_CLIENT]
    Q --> V[COMPLETED] --> W[Eligible review]
```

## Professional: onboarding and multiple categories

```mermaid
flowchart TD
    A[Pour les pros page] --> B[Sign up as professional]
    B --> C[Verify email]
    C --> D[Business identity, location, workplace type, visibility]
    D --> E[Select one or more categories]
    E --> F[Per category: services, prices, durations, media, schedule, capacity]
    F --> G{Regulated category?}
    G -->|Botox| H[Upload credentials, admin review]
    G -->|no| I[Submit profile for review]
    H --> I
    I --> J{Admin decision}
    J -->|approve| K[PUBLISHED, visible while subscription is in good standing]
    J -->|reject| L[Back to draft with reasons]
    K --> M[Unified dashboard: All categories or one category]
    M --> N[Request another category from Settings] --> J
```

## Subscription lifecycle

```mermaid
stateDiagram-v2
    [*] --> TRIALING
    TRIALING --> ACTIVE: first invoice paid
    TRIALING --> PAST_DUE: trial ends unpaid
    ACTIVE --> PAST_DUE: renewal invoice unpaid at period end
    PAST_DUE --> ACTIVE: payment verified
    PAST_DUE --> GRACE: grace window
    GRACE --> ACTIVE: payment verified
    GRACE --> EXPIRED: grace ends: profiles hidden, management restricted, data kept
    EXPIRED --> ACTIVE: payment verified
    ACTIVE --> CANCELLED: provider cancels at period end
    ACTIVE --> SUSPENDED: admin action
    SUSPENDED --> ACTIVE: admin action
    ACTIVE --> EXEMPT: admin exemption
```

## Admin: approve a provider

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin dashboard
    participant API
    participant DB
    Admin->>UI: Open the queue (/dashboard/admin/providers?filter=pending)
    UI->>API: Load account, profiles, requests, credentials, audit (server render)
    opt Regulated category (Botox)
        Admin->>API: GET /api/v1/admin/credentials/{id}/file
        API->>DB: AuditLog credential.view
        Admin->>UI: Validate the document
    end
    Admin->>UI: Publish (or request changes / reject with a written reason)
    UI->>API: Server Action reviewAction (ADMIN+ re-checked)
    API->>DB: Status + AuditLog + Notification + OutboxEvent (one transaction)
    API-->>UI: Cache tags invalidated, page refreshed, decision announced
```

SUPPORT can open the queue and the review page but every decision button is replaced by a read-only notice,
and the server refuses the decision anyway. A change request sends the profile back to DRAFT with the note,
which the professional sees above her profile and in her email.

## Admin: schedule a subscription price

```mermaid
sequenceDiagram
    actor Admin
    participant UI as /dashboard/admin/pricing
    participant API as manageAction
    participant DB
    participant Public as Pour les pros
    Admin->>UI: Price + start day (tomorrow or later)
    UI->>API: price.add (ADMIN+ re-checked, day validated in Algiers time)
    API->>DB: New CategorySubscriptionPricing row (00:00 Africa/Algiers) + AuditLog subscription.price.schedule
    Note over DB: Existing rows are never updated
    API-->>UI: "pricing" tag invalidated; history shows the row as upcoming
    Public->>DB: getPublicPricing(today) picks the latest row starting on or before today
```

Categories follow the same pattern (`category.activate` / `deactivate` / `reorder` / `credentials.*`):
deactivation hides every profile of the category at once because public queries require an active category.
On the Users page, a suspension (written reason) or a role change signs the person out everywhere; a suspended
professional, or one moved out of the PROVIDER role, disappears from public pages until restored.

## Booking management after the request

Rules: `src/lib/booking-rules.ts`. States: [architecture/booking-state-machine.mmd](architecture/booking-state-machine.mmd).

```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as Server (status-guarded writes)
    participant P as Professionnelle
    P->>S: Propose 12:00 (free slot, profile lock)
    S-->>C: Notification + email "Nouvel horaire proposé"
    Note over S: original 10:00 and proposed 12:00 both held
    C->>S: Accept
    S-->>P: "Nouvel horaire accepté" (start moves to 12:00, 10:00 freed)
    P->>S: After the visit: Terminé
    P->>S: Record 2 500 DA cash (her own bookkeeping)
    C->>S: One review (1 to 5 stars)
    Note over C,P: Either side can cancel before the start; the professional must give a reason.
```

Unanswered requests expire at `pendingExpiresAt` (48 hours or the start, whichever comes first)
when `npm run daily` runs; the client is told and the place is freed.
