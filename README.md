# Next.js Enterprise Boilerplate

A production-ready Next.js 16 starter with Microsoft Entra ID authentication,
OpenTelemetry observability, Prisma + PostgreSQL, and a TDD harness. Everything
wired up so you can start building features immediately.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL · Prisma 5 |
| Auth | Microsoft Entra ID via MSAL Node (single-tenant, PKCE) · JWE session cookies via `jose` |
| Observability | OpenTelemetry → OTLP collector → Jaeger + Prometheus + Grafana |
| Styling | Tailwind CSS (class-based dark mode, CSS variables) |
| Testing | Vitest (unit + integration) · Playwright (E2E) · MSW |
| Container | Docker Compose or Podman Compose (local infra) |

## Prerequisites

- Node 20+
- Docker or Podman (`podman machine` on macOS/Windows)
- A Microsoft Entra tenant (free M365 Developer tenant works — see setup guide)

## Quick start

```bash
git clone <your-repo-url>
cd nextjs-boiler-plate
npm install

cp .env.example .env              # Fill in values — see below
npm run infra:up                  # Postgres + OTEL stack
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The landing page is public; sign in to reach
`/dashboard` and `/settings`.

## Environment

Minimum in `.env`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/nextjs_boilerplate
APP_URL=http://localhost:3000
AUTH_SESSION_SECRET=$(openssl rand -base64 32)

AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
```

Integration tests use a separate DB on `5433` (provided by the Docker stack).

## Authentication & roles

Every environment needs a real Entra tenant. Two canonical app roles in
`src/lib/auth/roles.ts`: `Admin` and `User`. Authorization is enforced
server-side next to each verb via `requireRole()` / `requireAnyRole()`.
Client `useSession()` is for cosmetic UI gating only.

The `/settings/admin` page is the reference example — it calls
`await requireRole('Admin')` server-side; non-admins are redirected to
`/auth/unauthorized`.

Full setup: **[docs/entra-id-local-setup.md](./docs/entra-id-local-setup.md)** (local)
· **[docs/azure-production-setup.md](./docs/azure-production-setup.md)** (production runbook).

## Commands

```bash
npm run dev              # Dev server
npm run build            # Production build
npm test                 # Vitest (watch)
npm run test:unit        # Vitest with coverage (one-shot)
npm run test:integration # Integration tests (requires test DB on 5433)
npm run test:e2e         # Playwright
npm run lint             # ESLint
npm run format           # Prettier

npm run db:migrate       # prisma migrate dev
npm run db:generate      # Regenerate Prisma client
npm run db:studio        # Prisma Studio UI

npm run infra:up         # Start infra stack (Docker or Podman — auto-detected)
npm run infra:down       # Stop infra stack
npm run infra:logs       # Tail infra logs
```

## Observability

Dashboards bundled with the local infra:

- **Jaeger** — http://localhost:16686 (traces)
- **Prometheus** — http://localhost:9090 (metrics)
- **Grafana** — http://localhost:3001 (admin/admin)

See [OPENTELEMETRY.md](./OPENTELEMETRY.md) for span naming conventions and
how to add custom spans.

## Project layout

```
src/
├── app/
│   ├── page.tsx                 # Public landing
│   ├── layout.tsx
│   ├── (protected)/             # Auth-gated route group
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   └── settings/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       └── admin/page.tsx   # requireRole('Admin')
│   └── auth/                    # signin / callback / signout / unauthorized
├── components/                  # auth, nav, theme, ui
├── lib/                         # auth, errors, telemetry, prisma, utils
├── providers/                   # theme provider
└── proxy.ts                     # Edge session gate (Next 16 "proxy" naming)

__tests__/
├── unit/ · integration/ · e2e/
├── mocks/                       # MSW + Entra mocks
└── helpers/

prisma/      # schema.prisma, migrations/
infra/       # docker-compose + otel/prometheus/grafana config
docs/        # auth runbooks + theming + superpowers specs/plans
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — architecture reference for agents/contributors
- **[OPENTELEMETRY.md](./OPENTELEMETRY.md)** — tracing conventions
- **[infra/README.md](./infra/README.md)** — Docker stack details
- **[docs/entra-id-local-setup.md](./docs/entra-id-local-setup.md)** — local tenant + app registration walkthrough
- **[docs/azure-production-setup.md](./docs/azure-production-setup.md)** — production deployment runbook
- **[docs/features/theming.md](./docs/features/theming.md)** — dark mode + design tokens

## License

MIT
