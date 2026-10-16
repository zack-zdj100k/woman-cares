# Permissions matrix

Enforced on the server only (`src/server/policies/roles.ts` and ownership checks inside each
service). Hiding a link is never the protection. ✔ allowed, R read only, own = only rows she owns.

| Capability | Visitor | CLIENT | PROVIDER | SUPPORT | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|---|
| Browse public profiles | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Request an appointment | | ✔ (verified email) | | | | |
| Cancel / answer proposal / review | | own | | | | |
| Respond, propose, cancel, complete, record payment | | | own | | | |
| Edit profiles, services, hours | | | own | | | |
| Declare a subscription payment | | | own | | | |
| Review queue and professional file | | | | R | ✔ | ✔ |
| Publish / suspend / verify / credentials | | | | | ✔ | ✔ |
| Users: view | | | | R | ✔ | ✔ |
| Users: change role or status | | | | | within `canChangeRole` | ✔ (not herself) |
| Categories and prices | | | | R | ✔ | ✔ |
| Subscription terms, verify payments, run cycle | | | | R | ✔ | ✔ |
| Audit log | | | | | ✔ | ✔ |
| Private credential files | | | | | ✔ (each opening audited) | ✔ |
