# Testing Conventions

Project-specific testing setup. For Vitest / Playwright / MSW tutorials, follow the upstream docs — this file documents how *this repo* uses them.

## Three tiers

| Tier | Location | Runner / env | Rule of thumb |
|---|---|---|---|
| Unit | `__tests__/unit/` | Vitest · jsdom | Pure functions, components, route handlers with mocked deps. No I/O. |
| Integration | `__tests__/integration/` | Vitest · node · `vitest.integration.config.ts` (30s timeout) | Services against a real test DB on port 5433. MSW for Entra/Graph. |
| E2E | `__tests__/e2e/` | Playwright | Full browser, pre-baked JWE session cookies (`__tests__/helpers/mockSession.ts`). |

Coverage gate: **80%** lines/functions/branches/statements on unit suite (`vitest.config.ts`).

## Commands

```bash
npm test                              # watch
npm run test:unit                     # one-shot with coverage
npm run test:integration              # real DB on :5433 (needs npm run infra:up)
npm run test:e2e                      # Playwright
npm run test:coverage                 # coverage report

# single file
npx vitest run __tests__/unit/lib/approvals/priorityScore.test.ts
```

Pre-commit check: `npm run lint && npm run format:check && npm run test:unit`.

## Layered service pattern

Every service takes its dependencies via a `Deps` object and tests inject mocks. Example: `ApprovalService` takes an `IApprovalRepository`.

```ts
// src/services/approvalService.ts
export interface ApprovalServiceDeps {
  repo: IApprovalRepository
  // ...
}

// __tests__/unit/services/approvalService.test.ts
const repo: IApprovalRepository = {
  findById: vi.fn(),
  list: vi.fn(),
  // ...
}
const svc = new ApprovalService({ repo })
```

Do **not** call the real Prisma client from unit tests. Integration tests are the only place that hits Postgres, and they clean up per-test.

## Auth in tests

No test hits real Entra.

- **Unit** — mock `@azure/msal-node` + Graph fetches via MSW handlers in `__tests__/mocks/entra.ts`.
- **Integration** — same MSW handlers + real test DB. Provision a user with `prisma.user.upsert({ where: { entraOid: 'test-oid-…' } })`.
- **E2E** — call `setMockSession(page, { roles: ['Approver'] })` (from `__tests__/helpers/mockSession.ts`) to inject a valid JWE cookie before navigation.

`requireRole()` / `requireAnyRole()` tests: call with a session fixture and assert either return value or the `AppError.forbidden()` throw.

## Route handler tests

Pass a real `Request` / `NextRequest` and assert on the `Response`. The service it calls should be mocked.

```ts
import { POST } from '@/app/api/approvals/route'

it('returns 400 on invalid body', async () => {
  const req = new Request('http://localhost/api/approvals', {
    method: 'POST',
    body: JSON.stringify({ /* missing required fields */ }),
  })
  const res = await POST(req)
  expect(res.status).toBe(400)
})
```

## Component tests

`@testing-library/react` with the `render` helper from `__tests__/setup/test-utils.tsx` (which wraps `ThemeProvider` + any other providers needed for jsdom). Prefer queries by role/label over test IDs.

## MSW

Shared handlers in `__tests__/mocks/`. The server is started in `__tests__/setup/vitest.setup.ts`. Override per-test with `server.use(...handlers)`; it resets between tests.

## DB reset in integration tests

```ts
beforeEach(async () => {
  await prisma.approvalRequest.deleteMany()
  await prisma.priorityConfig.deleteMany()
  await prisma.message.deleteMany()
  await prisma.chat.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

Order matters — respect FK constraints.

## Path alias

`@/` → `src/` in both `tsconfig.json` and `vitest.config.ts`. Use it in imports.

## TDD loop

Red → green → refactor is the expectation for new features. Write the failing test first; get it green with the minimum change; refactor with tests still green. The 80% coverage gate is the floor, not the target — cover error paths and edge cases, not just the happy path.
