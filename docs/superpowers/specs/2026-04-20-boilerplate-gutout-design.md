# Boilerplate gut-out — enterprise-ready Next.js starter

**Status:** Approved
**Date:** 2026-04-20
**Branch / worktree:** `boilerplate-cleanup` at `~/Documents/Github/nextjs-boiler-plate-boilerplate`

## Goal

Turn this repository into a minimal, enterprise-ready Next.js 16 boilerplate. Remove all demo/MVP features while keeping the production-grade infrastructure (Entra ID auth, OpenTelemetry, Prisma + Postgres, error handling, Docker stack, testing harness). Replace the demo pages with a public landing page, a protected dashboard, and a protected settings page with a role-gated sub-section — just enough to showcase routing, layouts, RBAC, and styling.

## Approach

**Surgical deletion in place.** Work in a new worktree branched off `main`. Delete the four demo domains (approvals, chat, agent-teams, workflow builder) and everything that exists only to serve them. Keep the well-layered infrastructure intact. Add three simple generic pages. Rewrite docs.

## Route layout

```
src/app/
├── page.tsx                    # PUBLIC landing at "/"
├── layout.tsx                  # Root: ThemeProvider, fonts, globals.css
├── (protected)/                # Auth-gated route group
│   ├── layout.tsx              # Server: getActor() → renders app shell w/ nav + SessionProvider (auth gate is in middleware)
│   ├── dashboard/
│   │   └── page.tsx            # Authenticated welcome + one example card
│   └── settings/
│       ├── layout.tsx          # Sub-nav: Profile | Admin
│       ├── page.tsx            # /settings — profile display (name, email, role, photo)
│       └── admin/
│           └── page.tsx        # /settings/admin — await requireRole('Admin')
└── auth/                       # Unchanged
    ├── signin/page.tsx
    ├── callback/route.ts
    ├── signout/route.ts
    └── unauthorized/page.tsx
```

**Middleware:** unchanged. Public: `/`, `/auth/*`, static assets. Protected: `/(protected)/**` → redirect to `/auth/signin?returnTo=...` if unauthed.

**Top nav (inside `(protected)/layout.tsx`):** Links to Dashboard and Settings. `UserMenu` (avatar + dropdown with sign-out) and theme toggle on the right.

**Post-sign-in default:** `/dashboard`. `/` remains public even for signed-in users; signed-in visitors see a "Go to dashboard" CTA instead of "Sign in".

## Role model

Two canonical roles in `src/lib/auth/roles.ts`: **`Admin`** and **`User`**. Default for missing/unknown claim: `User`.

- Entra app-role **Value** strings must match these exactly — `docs/entra-id-local-setup.md` and `docs/azure-production-setup.md` updated to reflect the rename.
- `/settings/admin` is the one role-gated example — uses `await requireRole('Admin')` server-side.

## What gets deleted

### Demo route groups & pages
- `src/app/(protected)/approvals/`
- `src/app/chat/`
- `src/app/agent-teams/`
- `src/app/builder/`

### Demo API routes
- `src/app/api/approvals/`
- `src/app/api/chat/`
- `src/app/api/agent-teams/`
- `src/app/api/cron/`
- `src/app/api/sse/` (the approvals-specific SSE route; the generic helper in `lib/sse/` is audited separately — see below)

### Demo components
- `src/components/agentTeams/`
- `src/components/approval/`
- `src/components/chat/`
- `src/components/workflow/`

### Demo lib / services
- `src/lib/agent/`, `src/lib/agentTeams/`, `src/lib/approvals/`, `src/lib/chat/`
- `src/lib/formatters/` — audit; delete if only approvals UI uses it
- `src/services/` — likely fully empty after removals; delete the directory
- `src/lib/actions/` — audit; keep only generic helpers, else delete
- `src/lib/sse/` — audit; if only approvals-specific, delete entirely (SSE can be re-added when a real feature needs it)
- `src/lib/api/` — audit; keep shared helpers (e.g. Zod error formatting) if any, else delete
- `src/lib/ui/` — audit; keep only pieces used by the kept pages/components

### Prisma
Drop these models & enums: `Chat`, `Message`, `MessageRole`, `Workflow`, `WorkflowNode`, `WorkflowExecution`, `WorkflowStep`, `WorkflowExecutionStatus`, `StepStatus`, `ApprovalRequest`, `ApprovalCategory`, `ApprovalStatus`, `PriorityConfig`.

Delete the existing `prisma/migrations/` folder and generate a fresh `init` migration.

Delete `prisma/seed.js`. Remove the `prisma.seed` entry from `package.json`. Users provision on first sign-in.

### Tests
- Delete all `__tests__/unit/**` targeting deleted modules (approvals, chat, agent, agentTeams, workflow)
- Delete matching integration and E2E specs
- Keep auth tests, error-handler tests, telemetry tests, session-helper tests
- Keep `__tests__/mocks/entra.ts` and `__tests__/helpers/mockSession.ts`

### Docs
Delete:
- `AGENT_TEAM_BUILDER_DEMO.md`, `AGENT_TEAM_BUILDER_POC_DECISIONS.md`, `TDD.md`
- `docs/features/chat.md`, `docs/features/workflow-builder.md`
- `docs/superpowers/specs/*` that relate to deleted demos (audit; likely all except auth/React19-modernization/user-menu can go — and even those are historical, so audit individually; safe default is to keep only those still relevant to the remaining surface)

Keep:
- `docs/entra-id-local-setup.md`, `docs/azure-production-setup.md`
- `docs/features/theming.md`
- `OPENTELEMETRY.md`, `infra/README.md`

Rewrite: `README.md`, `CLAUDE.md` (details below).

### Dependencies — remove from `package.json`
- `@langchain/community`, `@langchain/core`, `@langchain/langgraph`, `@langchain/langgraph-checkpoint`, `@langchain/openai`, `langchain`
- `openai`, `@tavily/core`, `mathjs`
- `ai` (Vercel AI SDK), `react-markdown`
- `reactflow`, `yjs`, `y-websocket`
- Radix primitives unused by the pruned UI — likely `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-toast`. Final decision made at implementation time by scanning imports.

### Misc
- `scripts/` — keep infra scripts (`start-infra.sh`, `stop-infra.sh`, `infra-logs.sh`); delete any demo-specific scripts
- `.env.example` — drop `OPENAI_API_KEY`, `TAVILY_API_KEY`, `CRON_SECRET`

## What stays (with modifications)

### Auth — kept, role rename applied
- `src/lib/auth/` — all modules stay (`session.ts`, `cookies.ts`, `msal.ts`, `graph.ts`, `requireRole.ts`, `roles.ts`, etc.)
- `src/middleware.ts` — unchanged
- `src/app/auth/` — unchanged
- `src/lib/auth/roles.ts` — canonical values become `Admin` and `User`; default `User`; update all callers of `requireRole` / `requireAnyRole`
- `src/providers/session-provider.tsx` + `useSession()` — unchanged
- Session header forwarding (Edge middleware → Node `getActor()`) — unchanged

### Prisma — collapsed User model

```prisma
model User {
  id        String   @id @default(cuid())
  entraOid  String   @unique
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
  @@index([entraOid])
}
```

- `emailVerified` dropped (unused; Entra asserts email verification).
- `entraOid` becomes `NOT NULL` — all surviving users come from Entra.
- Fresh single `init` migration. Old `migrations/` folder removed.

### Infra — unchanged
- `src/instrumentation.ts` + `src/lib/telemetry/` (node + edge split)
- `infra/` Docker stack (Postgres + OTEL collector + Jaeger + Prometheus + Grafana)
- `src/lib/errors/` (`AppError`, `handleApiError`)
- `src/lib/prisma.ts`
- `src/lib/utils.ts` (`cn()` helper etc.)

### UI primitives
- **Keep:** `button`, `avatar`, `dropdown-menu`, `separator`. Add `skeleton` if already present; otherwise skip.
- **Delete:** `dialog`, `select`, `toast` (and their Radix deps).
- Rule during implementation: if no kept page/nav imports it, delete it.

### Custom components
- `src/components/auth/` — `UserMenu` and sign-in/out affordances
- `src/components/nav/` — top nav; strip demo links
- `src/components/theme/` — theme toggle + provider
- `src/components/ClientProviders.tsx` — trim to SessionProvider + ThemeProvider only

### New files to add
- `src/app/page.tsx` — rewrite as public landing (hero, CTA)
- `src/app/(protected)/layout.tsx` — calls `getActor()` and renders app shell (auth gate is in middleware; no role check needed — everyone authenticated is either `Admin` or `User`)
- `src/app/(protected)/dashboard/page.tsx` — authenticated welcome + one example card
- `src/app/(protected)/settings/layout.tsx` — sub-nav
- `src/app/(protected)/settings/page.tsx` — profile display
- `src/app/(protected)/settings/admin/page.tsx` — `await requireRole('Admin')` gate

## Docs rewrite

**`README.md`** — new intro: "Next.js 16 enterprise boilerplate — Entra ID auth, OpenTelemetry, Prisma, TDD harness". Updated `.env.example` section. Drop references to chat/agent/approvals/workflow. Keep Entra setup and observability sections.

**`CLAUDE.md`** — rewrite the Architecture section. Remove the "Approvals is the reference layering" callout; replace with a short "Adding a feature" section describing the three-layer pattern (repository → service → route) as the recommended approach, plus `/settings/admin` as the RBAC example. Keep Auth, Telemetry, Testing Conventions, Path Alias sections. Remove Real-time/SSE, AI Agent, Priority Scoring, demo schema notes.

**`docs/entra-id-local-setup.md`** and **`docs/azure-production-setup.md`** — update app-role Value strings to `Admin` and `User`; drop references to `Approver`/`Requester`.

**`docs/features/`** — delete `chat.md`, `workflow-builder.md`; keep `theming.md`.

## Testing conventions (unchanged)

- Unit: `__tests__/unit/` — jsdom, 80% coverage threshold enforced
- Integration: `__tests__/integration/` — node, hits real test DB on port 5433, 30s timeout
- E2E: `__tests__/e2e/` — Playwright
- Mocks: `__tests__/mocks/` — MSW + Entra mocks

## What to test

### Unit (must-have)
- `src/lib/auth/**` — session encode/decode, cookie helpers, role utilities, `requireRole`/`requireAnyRole`, MSAL client factory
- `src/lib/errors/**` — `AppError` factories, `handleApiError`
- `src/lib/telemetry/**` — span helpers
- Thin smoke tests for `UserMenu`, theme toggle, nav component (add if missing)
- Overall: meet 80% coverage on the surviving surface area

### Integration
- Auth callback flow (MSAL mocked via MSW, real test DB): successful sign-in → user upsert → session cookie set
- Role gate: `requireRole('Admin')` against a `User`-role session returns 403

### E2E (Playwright)
- Redirect unauthed visitor from `/dashboard` → `/auth/signin?returnTo=/dashboard`
- Signed-in user (cookie injected via `mockSession.ts`) can reach `/dashboard` and `/settings`
- Non-admin hitting `/settings/admin` → redirected to `/auth/unauthorized`
- Admin hitting `/settings/admin` → sees the admin panel
- Sign-out clears session and redirects to `/`

## Verification before claiming done

In order, in the worktree:

1. `npm install` — clean install after dep removal; no unmet peer warnings
2. `npm run db:generate && npm run db:migrate` — fresh init migration applies cleanly
3. `npm run lint` — passes
4. `npm run test:unit` — passes with coverage ≥ 80%
5. `npm run test:integration` — passes against test DB
6. `npm run build` — succeeds
7. `npm run dev` — app starts; smoke-test the five flows above (or rely on E2E)
8. `npm run test:e2e` — passes
9. Grep sweep for residual references: `approval`, `chat`, `agent`, `workflow`, `tavily`, `langchain`, `langgraph`, `mathjs`, `reactflow`, `yjs`, `Approver`, `Requester` — none in `src/`, `__tests__/`, `prisma/`, or top-level docs

## Out of scope

- CI workflow changes — existing `.github/workflows/*` stay as-is; if they reference deleted paths the user can adjust later
- Repo rename or npm package rename — `name` in `package.json` stays `nextjs-enterprise-boilerplate`
- Dependency upgrades beyond removal (no Next/React/Prisma bumps)
- New features beyond the three pages described

## Open decisions deferred to implementation

Minor judgment calls recorded during implementation go into `NOTES-FOR-REVIEW.md` at the worktree root for later user review:

- Whether `src/lib/sse/`, `src/lib/api/`, `src/lib/actions/`, `src/lib/formatters/`, `src/lib/ui/` have any non-demo content worth preserving
- Final list of Radix deps to remove
- Any tests that need to be added (beyond the existing auth/errors/telemetry coverage) to meet the 80% gate
