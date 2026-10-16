@AGENTS.md

# Woman Cares: project instructions

- Product brief summary: docs/PRODUCT_REQUIREMENTS.md. Current status: docs/ROADMAP.md (update it at the end of each session; mark a phase done only when verified).
- Design authority for this project: docs/DESIGN.md (owner's references win over the global design library).
- Keep docs/SITE_MAP.md, docs/DATABASE_ERD.md, docs/USER_FLOWS.md and docs/ARCHITECTURE.md diagrams in sync with routes, schema and flows.
- Never seed or display invented professionals, reviews, counts, credentials, payments or email delivery.
- French copy uses typographic apostrophes (’). No em dashes in UI copy.
- Server is the authority for roles, ownership, capacity, subscription state and payments.
- Checks before calling work done: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and Playwright screenshots at 375/768/1440 in FR and AR (scripts/hero-shots.mjs, scripts/page-shot.mjs).
