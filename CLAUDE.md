# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Build for production
npm test                 # Run unit tests (watch mode)
npm run test:unit        # Run unit tests with coverage (one-shot)
npm run test:integration # Run integration tests (requires live DB on port 5433)
npm run test:e2e         # Run Playwright E2E tests
npm run test:coverage    # Run unit tests with coverage report
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Run a single test file
npx vitest run __tests__/unit/lib/approvals/priorityScore.test.ts

# Database
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate       # Run migrations (dev)
npm run db:seed          # Seed dev users and priority configs
npm run db:studio        # Open Prisma Studio

# Infrastructure (Docker)
npm run infra:up         # Start PostgreSQL, OTEL Collector, Jaeger, Prometheus, Grafana
npm run infra:down       # Stop all infrastructure
```

## Environment Setup

Copy `.env.example` → `.env` and configure:
- `DATABASE_URL` — PostgreSQL (default port 5432 via Docker)
- `OPENAI_API_KEY` — Required for chat/agent features
- `TAVILY_API_KEY` — Required for agent web search tool
- `NEXTAUTH_SECRET` — Random secret for session signing
- `NEXTAUTH_URL` — App URL (`http://localhost:3000` for local)

Integration tests use a separate DB on port 5433 (`DATABASE_URL_TEST` or a test-specific `.env.test`).

## Architecture

### Layered Service Architecture (Approvals domain)

The approvals feature follows a strict three-layer pattern that should be used as the model for new features:

1. **Repository** (`src/lib/approvals/repository.ts`) — raw Prisma queries, implements `IApprovalRepository` interface for DI
2. **Service** (`src/services/approvalService.ts`) — business logic, uses repository via constructor injection (`ApprovalServiceDeps`), throws typed `AppError` instances
3. **Route handler** (`src/app/api/approvals/`) — validates input with Zod schemas, calls service, broadcasts SSE events, delegates error formatting to `handleApiError`

Always inject repository into service via constructor for testability. Route handlers should not contain business logic.

### Error Handling

`src/lib/errors/AppError.ts` defines typed errors with HTTP status codes. Factory functions (`notFound`, `alreadyResolved`, `lockedByOther`, etc.) create domain errors. `handleApiError` in `src/lib/errors/handler.ts` translates `AppError` to JSON responses. Throw `AppError` from services; catch with `handleApiError` in routes.

### Real-time: SSE

`src/lib/approvals/sseServer.ts` manages a `globalThis`-stored `Set` of SSE writer connections. This global is critical — without it, the SSE route and API routes each get separate module instances with separate client sets, so broadcasts would silently drop. Call `broadcastApprovalEvent()` from route handlers after mutations. The client hook lives at `src/lib/sse/useApprovalEvents.ts`.

### AI Agent

`src/lib/agent/agent.ts` creates a LangGraph ReAct agent with GPT-4o-mini, a Tavily web search tool, and a Calculator tool. Uses `MemorySaver` (in-memory, resets on server restart). For production persistence, swap to `@langchain/langgraph-checkpoint-postgres`. The agent is a module-level singleton via `getAgent()`.

Chat streaming uses two routes:
- `src/app/api/chat/route.ts` — simple OpenAI streaming (Vercel AI SDK)
- `src/app/api/chat/agent/route.ts` — LangGraph agent with tool use + SSE streaming

### Database Schema Key Models

- **ApprovalRequest** — has `status` (PENDING/REVIEWING/APPROVED/REJECTED/CANCELLED), `assigneeId` + `lockExpiresAt` for reviewer locking, `category` (P1-P4)
- **PriorityConfig** — per-category config for `baseWeight`, `agingFactor`, `slaHours`, `lockTimeoutMinutes`; seeded via `prisma/seed.js`
- **Chat / Message** — persisted chat history; `Message.role` is `USER | ASSISTANT | SYSTEM`

### Priority Scoring

`src/lib/approvals/priorityScore.ts` computes `baseWeight + ageInDays * agingFactor`. Score increases as requests age. P1 starts highest (weight 100, aging 2.0/day, SLA 24h), P4 lowest (weight 25, aging 0.5/day, SLA 120h).

### Telemetry

`src/instrumentation.ts` is the Next.js instrumentation hook. Node runtime uses `src/lib/telemetry/instrumentation.node.ts`; Edge runtime uses `.edge.ts`. Wrap operations with `createSpan('span.name', async () => {...})` from `src/lib/telemetry/tracing.ts`.

### Testing Conventions

- Unit tests: `__tests__/unit/` — jsdom environment, 80% coverage threshold enforced
- Integration tests: `__tests__/integration/` — node environment, hits real test DB, 30s timeout
- E2E tests: `__tests__/e2e/` — Playwright
- Mocks: `__tests__/mocks/` — MSW handlers
- Services are tested by injecting a mock repository implementing `IApprovalRepository`

### Path Alias

`@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).
