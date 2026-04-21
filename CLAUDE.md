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
- `APP_URL` — Absolute app URL (e.g., `http://localhost:3000`); used to build the Entra redirect URI and validate `returnTo`
- `AUTH_SESSION_SECRET` — ≥32-byte base64 secret; HKDF input for the JWE session key. Generate with `openssl rand -base64 32`
- `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` — Entra ID app registration (single-tenant). See setup guide below
- `OPENAI_API_KEY` — Required for chat/agent features
- `TAVILY_API_KEY` — Required for agent web search tool
- `CRON_SECRET` — Protects `/api/cron/*` routes

Integration tests use a separate DB on port 5433 (`TEST_DATABASE_URL` or a test-specific `.env.test`).

### Local Entra ID setup

Auth has **no dev fallback** — every environment needs a real Entra tenant. For step-by-step instructions (create a free M365 Developer tenant, register the app, configure redirect URI, create app roles, assign users, wire env vars), see **`docs/entra-id-local-setup.md`**.

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

`src/lib/agent/agent.ts` builds a tool-calling agent via `createAgent` from the `langchain` package (v1), with GPT-4o-mini, a Tavily web search tool, and a `mathjs`-backed calculator tool (both defined with the `tool()` factory). Uses `MemorySaver` from `@langchain/langgraph` (in-memory, resets on server restart). For production persistence, swap to `@langchain/langgraph-checkpoint-postgres`. The agent is a module-level singleton via `getAgent()`.

Chat streaming uses two routes:
- `src/app/api/chat/route.ts` — simple OpenAI streaming (Vercel AI SDK)
- `src/app/api/chat/agent/route.ts` — LangGraph agent with tool use + SSE streaming

### Auth (Entra ID + MSAL Node)

Microsoft Entra ID via MSAL Node (Authorization Code + PKCE, single-tenant). **No dev fallback.** Browser never holds tokens.

- **Runtime split**: `src/middleware.ts` runs on Edge — decrypts the JWE session cookie with `jose`, gates every non-`/auth/*` route, and forwards the verified payload via `SESSION_HEADER` so Node-side `getActor()` / `getSessionForClient()` skip a redundant decrypt. `/auth/{signin,callback,signout}` route handlers run on Node (MSAL + Prisma + Graph).
- **Session**: encrypted cookie (JWE), 12h TTL with sliding refresh at 6h via `getActor()` — see `src/lib/auth/session.ts`, `src/lib/auth/cookies.ts`. Secret derived via HKDF-SHA256 from `AUTH_SESSION_SECRET`.
- **Authorization**: `authN` enforced in middleware; `authZ` enforced next to each verb. Use `await requireRole('Approver')` or `requireAnyRole(['Approver','Admin'])` from `src/lib/auth/requireRole.ts` inside services/Server Actions. Throws `AppError.forbidden()` → 403.
- **Roles**: three canonical values in `src/lib/auth/roles.ts` — `Admin`, `Approver`, `Requester`. Missing/unknown claim defaults to `Requester`. App Role **Value** strings in the Entra portal must match these exactly.
- **Client-side session**: protected layout calls `getActor()` server-side and passes non-secret facts (`userId`, `roles`, `name`, `photoUrl`) to `<SessionProvider>`. Client `useSession()` is for cosmetic UI gating only — authoritative enforcement is always server-side `requireRole()`.
- **User provisioning**: `prisma.user.upsert({ where: { entraOid } })` on every callback — `entraOid` (Entra `oid` claim) is the stable identity. Profile photo fetched once via Graph `/me/photo/$value` at sign-in and cached on `User.image`.
- **Testing**: unit tests mock MSAL + Graph via MSW (`__tests__/mocks/entra.ts`); integration tests use MSW + real test DB; E2E injects pre-baked JWE cookies via `__tests__/helpers/mockSession.ts`. No test ever hits real Entra.

### Database Schema Key Models

- **User** — `entraOid` (unique) is the stable Entra identity; `id` is cuid (foreign key target for approvals). Users are provisioned on first sign-in — `prisma/seed.js` does not create users
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

### AI Provider

LLM calls route through `src/lib/ai/`. Two provider kinds, switched via `LLM_PROVIDER`:

- `openai` — uses the `openai` SDK and `@langchain/openai`'s `ChatOpenAI`. Takes `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` (for OpenAI-compatible endpoints — Azure AI Foundry serverless, APIM proxies, Ollama), and `OPENAI_CHAT_MODEL`.
- `azure-openai` — classic Azure OpenAI. Uses `AzureOpenAI` and `AzureChatOpenAI`. Takes `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_CHAT_DEPLOYMENT`.

Callers use `getChatClient()` (raw OpenAI-shaped client), `getChatModel({model, temperature})` (LangChain chat model), or `chatModelName()` (the string to pass as `model` on raw SDK calls). On Azure, `getChatModel`'s `model` override is ignored — the deployment env wins. For agent-team nodes where the UI lets a user pick a model per node, that string is interpreted as a deployment name under the `azure-openai` provider. An ESLint rule forbids importing `openai` or `@langchain/openai` outside `src/lib/ai/**`.
