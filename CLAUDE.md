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
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Database
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:migrate       # Run migrations (dev)
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

Integration tests use a separate DB on port 5433 (`TEST_DATABASE_URL` or a test-specific `.env.test`).

### Local Entra ID setup

Auth has **no dev fallback** — every environment needs a real Entra tenant. For step-by-step instructions, see **`docs/entra-id-local-setup.md`**.

## Architecture

### Auth (Entra ID + MSAL Node)

Microsoft Entra ID via MSAL Node (Authorization Code + PKCE, single-tenant). **No dev fallback.** Browser never holds tokens.

- **Runtime split**: `src/proxy.ts` is the Next.js 16 proxy (edge middleware). It decrypts the JWE session cookie with `jose`, gates every non-public route, and forwards the verified payload via `SESSION_HEADER` so Node-side `getActor()` / `getSessionForClient()` skip a redundant decrypt. `/auth/{signin,callback,signout}` route handlers run on Node (MSAL + Prisma + Graph).
- **Session**: encrypted cookie (JWE), 12h TTL with sliding refresh at 6h via `getActor()` — see `src/lib/auth/session.ts`, `src/lib/auth/cookies.ts`. Secret derived via HKDF-SHA256 from `AUTH_SESSION_SECRET`.
- **Authorization**: `authN` enforced in the proxy; `authZ` enforced next to each verb. Use `await requireRole('Admin')` or `requireAnyRole(['Admin','User'])` from `src/lib/auth/requireRole.ts` inside server components / Server Actions. Throws `AppError.forbidden()` → 403 / redirect to `/auth/unauthorized`.
- **Roles**: two canonical values in `src/lib/auth/roles.ts` — `Admin` and `User`. Missing/unknown claim defaults to `User`. App Role **Value** strings in the Entra portal must match these exactly.
- **Client-side session**: protected layout calls `getSessionForClient()` server-side and passes non-secret facts (`userId`, `roles`, `name`, `email`, `photoUrl`) to `<SessionProvider>`. Client `useSession()` is for cosmetic UI gating only — authoritative enforcement is always server-side `requireRole()`.
- **User provisioning**: `prisma.user.upsert({ where: { entraOid } })` on every callback — `entraOid` (Entra `oid` claim) is the stable identity. Profile photo fetched once via Graph `/me/photo/$value` at sign-in and cached on `User.image`.
- **Testing**: unit tests mock MSAL + Graph via MSW (`__tests__/mocks/entra.ts`); integration tests use MSW + real test DB; E2E injects pre-baked JWE cookies via `__tests__/helpers/mockSession.ts`. No test ever hits real Entra.

### Reference RBAC example

`src/app/(protected)/settings/admin/page.tsx` calls `await requireRole(Role.Admin)` at the top and catches `AppError.forbidden()` to redirect non-admins to `/auth/unauthorized?reason=forbidden`. Use this as the pattern when adding new role-gated pages or verbs.

### Adding a feature — recommended layering

When a feature has any business logic, use the three-layer pattern:

1. **Repository** — raw Prisma queries behind an interface (e.g., `IFooRepository`), for dependency injection in service tests
2. **Service** — business logic, accepts the repository via constructor injection, throws typed `AppError` instances
3. **Route handler** — validates input with Zod, calls the service, delegates error formatting to `handleApiError` from `src/lib/errors/handler.ts`

### Error Handling

`src/lib/errors/AppError.ts` defines typed errors with HTTP status codes. Factory functions (`notFound`, `forbidden`, `validationError`, `unauthorized`) create domain errors. `handleApiError` in `src/lib/errors/handler.ts` translates `AppError` to JSON responses. Throw `AppError` from services; catch with `handleApiError` in routes.

### Telemetry

`src/instrumentation.ts` is the Next.js instrumentation hook. Node runtime uses `src/lib/telemetry/instrumentation.node.ts`; Edge runtime uses `.edge.ts`. Wrap operations with `createSpan('span.name', async () => {...})` from `src/lib/telemetry/tracing.ts`.

### Database Schema

One model: `User` — `entraOid` (unique) is the stable Entra identity; `id` is cuid. Users are provisioned on first sign-in — there is no seed.

### Testing Conventions

- Unit tests: `__tests__/unit/` — jsdom environment, 80% coverage threshold enforced
- Integration tests: `__tests__/integration/` — node environment, hits real test DB, 30s timeout
- E2E tests: `__tests__/e2e/` — Playwright
- Mocks: `__tests__/mocks/` — MSW handlers

### Path Alias

`@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).
