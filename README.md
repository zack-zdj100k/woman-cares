# Woman Cares

Beauty and self-care marketplace for women in Algeria. French (LTR) and Arabic (RTL).

> Status: the public website and authentication are built (homepage, six directories with filters,
> profiles, content pages, sign-up/sign-in, email verification, password reset, role-guarded dashboards).
> Professionals can complete their category profiles (services, photos, hours) and send them for review.
> The admin review queue, booking, billing and the CMS are next. See [docs/ROADMAP.md](docs/ROADMAP.md) for the honest per-phase status.

## Requirements

- Node.js 20+ (developed on 25)
- PostgreSQL 15+ (developed on 17)
- ffmpeg (only to rebuild the hero film)

## Local setup

```bash
npm install
```

Create a database role and databases (adjust the password):

```bash
psql -d postgres -c "CREATE ROLE woman_cares LOGIN PASSWORD 'change-me' CREATEDB;"
```

```bash
createdb -O woman_cares woman_cares_dev && createdb -O woman_cares woman_cares_test
```

Copy `.env.example` to `.env` and set `DATABASE_URL`, `TEST_DATABASE_URL` and `AUTH_SECRET`. Then:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000 (redirects to `/fr` or `/ar`).

The seed inserts reference data only (wilayas, categories, default pricing, settings). It never creates
fake professionals, reviews or bookings.

To see the directories with content during local development, add the clearly labelled demo businesses
(refuses to run in production; no reviews or bookings; images are frames from the hero film):

```bash
npm run db:seed:demo
```

Remove them with `ALLOW_DEMO_SEED=1 npx tsx prisma/seed-demo.ts --remove`.

Uploaded media are stored under `.storage/` (`public/` is served at `/uploads/*`, `private/` never is).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` · `npm run lint` | Static checks |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against `TEST_DATABASE_URL` |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:generate` | Prisma |
| `npm run db:seed:demo` | Local demo businesses (development only) |
| `npm run admin:create -- --email you@example.com --name "Prénom Nom"` | Creates the first Super Admin (password prompted, or from `SUPER_ADMIN_PASSWORD`) |
| `npm run outbox:deliver` | Sends due emails and retries; schedule every minute in production |

## Environment

See [.env.example](.env.example). Email defaults to the `log` transport: messages, including verification
and reset links, are printed to the dev server console. Nothing is sent until `EMAIL_TRANSPORT=smtp` and the
SMTP variables are set and delivery is tested; the log transport is refused in production. Media storage
defaults to the local disk. Subscription payments default to manual admin verification.

## Replacing media

- Hero film: `public/media/hero-woman-cares.mp4` and `hero-woman-cares-960.mp4`. If chapter timings
  change, update `src/config/categories.ts`. The ffmpeg command is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Illustrated backgrounds: `public/images/backgrounds/`.

## Documentation

[Product requirements](docs/PRODUCT_REQUIREMENTS.md) · [Site map](docs/SITE_MAP.md) ·
[User flows](docs/USER_FLOWS.md) · [Roadmap](docs/ROADMAP.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Database ERD](docs/DATABASE_ERD.md) · [API](docs/API_SPECIFICATION.md) · [Security](docs/SECURITY.md) ·
[Test plan](docs/TEST_PLAN.md) · [Design system](docs/DESIGN.md)

## Troubleshooting

- `DATABASE_URL is not set`: create `.env` from `.env.example`.
- Prisma client missing: `npm run db:generate` (it also runs on `postinstall`).
- Playwright "Executable doesn't exist": run `npx playwright install chromium`.
