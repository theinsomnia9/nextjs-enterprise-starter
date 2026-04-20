# Next.js Enterprise Boilerplate

A production-minded Next.js 16 app with Microsoft Entra ID auth, full OpenTelemetry observability, streaming chat (plain + LangGraph agent), a visual workflow canvas, and a priority-scored approvals queue. Built TDD-first with an 80% coverage gate.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL · Prisma 5 |
| Auth | Microsoft Entra ID via MSAL Node (single-tenant, PKCE) · JWE session cookies via `jose` |
| AI | OpenAI GPT-4o-mini · LangGraph agent (`langchain` v1) with Tavily + `mathjs` tools |
| Real-time | Server-Sent Events (SSE) · Yjs (canvas CRDT) |
| Observability | OpenTelemetry → OTLP collector → Jaeger + Prometheus + Grafana |
| Styling | Tailwind CSS (class-based dark mode, CSS variables) |
| Testing | Vitest (unit + integration) · Playwright (E2E) · MSW |
| Container | Docker Compose or Podman Compose (local infra) |

## Prerequisites

- Node 20+
- A container engine: Docker (Docker Desktop / OrbStack / Colima) **or** Podman (`podman machine` on macOS/Windows). The `infra:*` scripts auto-detect either engine.
- A Microsoft Entra tenant (free M365 Developer tenant works — see setup guide)

## Quick start

```bash
git clone <your-repo-url>
cd nextjs-boiler-plate
npm install

cp .env.example .env              # Fill in values — see below
npm run infra:up                  # Postgres + OTEL stack
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. Middleware redirects you to `/auth/signin` — there's no dev fallback.

## Environment

Minimum required in `.env` (see `.env.example` for the full list):

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/nextjs_boilerplate
APP_URL=http://localhost:3000
AUTH_SESSION_SECRET=$(openssl rand -base64 32)

# From your Entra app registration (docs/entra-id-local-setup.md)
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...

OPENAI_API_KEY=sk-...              # chat + agent
TAVILY_API_KEY=tvly-...            # agent web search tool
CRON_SECRET=...                    # protects /api/cron/*
```

**Integration tests** use a separate DB on `5433` (provided by the Docker stack) — configured via `TEST_DATABASE_URL` or `.env.test`.

## Authentication & roles

Every environment needs a real Entra tenant. Three canonical app roles in `src/lib/auth/roles.ts`:

| Role | Can do |
|---|---|
| `Admin` | Everything, including editing `PriorityConfig` |
| `Approver` | Lock / approve / reject approval requests |
| `Requester` *(default)* | Submit and view own requests |

Authorization is enforced server-side next to each verb via `requireRole()` / `requireAnyRole()`. Client `useSession()` is for cosmetic UI gating only.

Full setup: **[docs/entra-id-local-setup.md](./docs/entra-id-local-setup.md)** (local) · **[docs/azure-production-setup.md](./docs/azure-production-setup.md)** (production runbook).

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
npm run db:seed          # Seed priority configs
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

See [OPENTELEMETRY.md](./OPENTELEMETRY.md) for span naming conventions and how to add custom spans. Infrastructure details in [infra/README.md](./infra/README.md).

## Architecture highlights

Details in [CLAUDE.md](./CLAUDE.md). The approvals feature is the reference layering:

1. **Repository** (`src/lib/approvals/repository.ts`) — raw Prisma, implements `IApprovalRepository`
2. **Service** (`src/services/approvalService.ts`) — business logic, typed `AppError` instances, repo injected via constructor
3. **Route handler** (`src/app/api/approvals/**`) — Zod input validation → service call → SSE broadcast → `handleApiError`

Use this pattern when adding new domain features.

## Project layout

```
src/
├── app/                         # Next.js App Router
│   ├── api/                     # Route handlers: chat, approvals, cron, sse, agent-teams
│   ├── (protected)/             # Auth-gated route group
│   ├── auth/                    # signin / callback / signout (Node runtime)
│   ├── chat/ · builder/ · agent-teams/
│   └── layout.tsx · page.tsx
├── components/                  # UI (chat, workflow, approval, agentTeams, theme, nav)
├── lib/                         # Domain + infra (approvals, auth, agent, chat, sse, telemetry, errors)
├── services/                    # approvalService.ts, agentTeamService.ts
├── providers/                   # ThemeProvider, SessionProvider
├── middleware.ts                # Edge session gate
└── instrumentation.ts           # OTEL entry point

__tests__/
├── unit/ · integration/ · e2e/
├── mocks/                       # MSW + Entra mocks
└── helpers/ · setup/

prisma/      # schema.prisma, migrations/, seed.js
infra/       # docker-compose + otel/prometheus/grafana config
docs/        # feature reference + auth runbooks + superpowers specs
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — architecture reference (source of truth for agents/contributors)
- **[TDD.md](./TDD.md)** — project testing conventions
- **[OPENTELEMETRY.md](./OPENTELEMETRY.md)** — tracing conventions
- **[infra/README.md](./infra/README.md)** — Docker stack details
- **[docs/entra-id-local-setup.md](./docs/entra-id-local-setup.md)** — Entra tenant + app registration walkthrough
- **[docs/azure-production-setup.md](./docs/azure-production-setup.md)** — production deployment runbook
- **[docs/features/](./docs/features/)** — per-feature reference: [chat](./docs/features/chat.md) · [workflow-builder](./docs/features/workflow-builder.md) · [theming](./docs/features/theming.md)
- **[docs/superpowers/](./docs/superpowers/)** — archived design specs and implementation plans

## License

MIT
