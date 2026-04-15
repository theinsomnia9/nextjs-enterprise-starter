---
description: Test-Driven Development workflow for building features with Vitest unit/integration tests and Playwright E2E tests. Use this when implementing any new feature, component, API route, or bug fix.
---

# TDD Workflow — Red / Green / Refactor

Follow these steps **in order** for every code change. Never skip directly to implementation.

---

## Step 0 — Understand the Requirement

1. Read the user request carefully and identify:
   - **What** is being built (component, API route, utility, page, hook, etc.)
   - **Where** it fits in the project structure (`src/`, `prisma/`, etc.)
   - **Acceptance criteria** — concrete behaviors the user expects.
2. Determine which test layers are needed:
   - **Unit tests** (always) → `__tests__/unit/`
   - **Integration tests** (API routes, DB operations) → `__tests__/integration/`
   - **E2E tests** (user-facing workflows) → `__tests__/e2e/`

---

## Step 1 — RED: Write Failing Tests First

Before writing **any** production code:

### Unit Tests (Vitest)
// turbo
3. Create the test file mirroring the source path:
   - Source: `src/components/feature/MyComponent.tsx`
   - Test:   `__tests__/unit/components/feature/MyComponent.test.tsx`
   - Source: `src/lib/myUtil.ts`
   - Test:   `__tests__/unit/lib/myUtil.test.ts`

4. Write tests using this template:
```typescript
import { describe, it, expect, vi } from 'vitest'

describe('<FeatureName>', () => {
  it('should <expected behavior>', () => {
    // Arrange
    // Act
    // Assert
  })

  it('should handle edge case: <description>', () => {
    // Arrange
    // Act
    // Assert
  })

  it('should throw/return error when <invalid condition>', () => {
    // Arrange
    // Act & Assert
  })
})
```

5. For React components, use the custom render from test-utils:
```typescript
import { render, screen, fireEvent, waitFor } from '../../../setup/test-utils'
```

6. Mock external dependencies (ReactFlow, next/navigation, next-auth, etc.) at the top of the test file using `vi.mock()`.

7. If the feature calls APIs, add MSW handlers in `__tests__/mocks/handlers/` and register them in `__tests__/mocks/handlers/index.ts`.

### Integration Tests (Vitest — Node env)
8. For API routes or DB operations, create tests in `__tests__/integration/`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
```

### E2E Tests (Playwright)
9. For user-facing features, create specs in `__tests__/e2e/`:
```typescript
import { test, expect } from '@playwright/test'

test.describe('<Feature>', () => {
  test('should <user workflow description>', async ({ page }) => {
    await page.goto('/<route>')
    // Use accessible selectors: getByRole, getByText, getByTestId
  })
})
```

### Run and confirm RED
// turbo
10. Run the tests — they **must fail**:
```bash
npx vitest run __tests__/unit/<path-to-test-file>
```
11. Verify the failure is the **expected** failure (missing module/function, wrong return value) — not a test syntax error.

---

## Step 2 — GREEN: Implement Minimum Code to Pass

12. Create or modify only the production files needed.
13. Write the **minimum** code to make the failing tests pass.
14. Follow these project conventions:
    - Use `'use client'` directive for components with hooks/interactivity.
    - Use the `@/` path alias for imports from `src/`.
    - Use `cn()` from `@/lib/utils` for className merging.
    - Use Tailwind CSS for styling (no inline styles or CSS modules).
    - Use `zod` for input validation on API routes.
    - Wrap significant operations with OpenTelemetry spans via `createSpan()` from `@/lib/telemetry/tracing`.
    - Add `data-testid` attributes to key interactive elements for E2E testability.

### Run and confirm GREEN
// turbo
15. Run the specific test file:
```bash
npx vitest run __tests__/unit/<path-to-test-file>
```
16. All tests must pass. If any fail, fix the **implementation** (not the tests) unless the test has a genuine bug.

---

## Step 3 — REFACTOR: Improve Quality While Green

17. Improve the code:
    - Extract shared logic into utilities.
    - Simplify conditionals.
    - Add proper TypeScript types (no `any` unless absolutely necessary).
    - Ensure exported types are co-located with their source.
18. Add OpenTelemetry instrumentation if the code:
    - Handles API requests → add spans with HTTP semantic conventions.
    - Performs database operations → add spans with DB semantic conventions.
    - Executes business logic → add spans with `{domain}.{operation}` naming.

### Run and confirm still GREEN
// turbo
19. Run full unit test suite:
```bash
npx vitest run
```
20. All 21+ tests must still pass.

---

## Step 4 — COVERAGE: Verify Thresholds

// turbo
21. Run coverage:
```bash
npx vitest run --coverage 2>&1 | tail -30
```
22. Check that **your new files** meet these thresholds:
    - Lines: ≥ 80%
    - Functions: ≥ 80%
    - Branches: ≥ 80%
    - Statements: ≥ 80%
23. If coverage is below threshold for your new code, add more tests (edge cases, error paths, conditional branches).

---

## Step 5 — LINT & FORMAT

// turbo
24. Run lint:
```bash
npx next lint --quiet
```

// turbo
25. Run format check:
```bash
npx prettier --check "src/**/*.{ts,tsx}" "__tests__/**/*.{ts,tsx}"
```

26. Fix any issues found. Formatting:
```bash
npx prettier --write "src/**/*.{ts,tsx}" "__tests__/**/*.{ts,tsx}"
```

---

## Step 6 — E2E (When Applicable)

27. If E2E specs were written in Step 1, run them:
```bash
npx playwright test __tests__/e2e/<spec-file> --project=chromium
```
28. If the dev server is not running, Playwright will start one automatically via the `webServer` config.
29. All E2E tests must pass.

---

## Step 7 — FINAL VERIFICATION

// turbo
30. Run the complete test suite:
```bash
npx vitest run
```

31. Summarize to the user:
    - Tests written (count and file paths)
    - Tests passing
    - Coverage for new files
    - Any E2E results
    - Lint status

---

## Quick Reference — File Locations

| Type               | Location                                     | Runner            |
|--------------------|----------------------------------------------|-------------------|
| Unit tests         | `__tests__/unit/**/*.test.{ts,tsx}`          | `npm run test:unit` |
| Integration tests  | `__tests__/integration/**/*.test.{ts,tsx}`   | `npm run test:integration` |
| E2E tests          | `__tests__/e2e/**/*.spec.ts`                 | `npm run test:e2e` |
| MSW handlers       | `__tests__/mocks/handlers/*.ts`              | Used by unit tests |
| Test utilities     | `__tests__/setup/test-utils.tsx`             | Imported in tests  |
| Vitest setup       | `__tests__/setup/vitest.setup.ts`            | Auto-loaded        |

## Quick Reference — Test Commands

| Command                          | Purpose                            |
|----------------------------------|------------------------------------|
| `npx vitest run`                 | Run all unit tests once            |
| `npx vitest run --coverage`     | Unit tests + coverage report       |
| `npx vitest watch`              | Watch mode for TDD red-green loop  |
| `npx vitest run __tests__/unit/path/file.test.ts` | Run single test file |
| `npx playwright test`           | Run all E2E tests                  |
| `npx playwright test --project=chromium` | E2E on Chrome only        |
| `npx playwright test __tests__/e2e/file.spec.ts` | Run single E2E spec   |

## Mocking Cheat Sheet

### Next.js Router (already in vitest.setup.ts)
```typescript
// Already mocked globally — override per-test if needed:
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/custom-path',
  useSearchParams: () => new URLSearchParams('?q=test'),
}))
```

### ReactFlow
```typescript
vi.mock('reactflow', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  MiniMap: () => <div data-testid="minimap" />,
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  Handle: ({ type }: any) => <div data-testid={`handle-${type}`} />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useNodesState: (init: any[]) => [init, vi.fn(), vi.fn()],
  useEdgesState: (init: any[]) => [init, vi.fn(), vi.fn()],
  addEdge: vi.fn((params, edges) => [...edges, params]),
  BackgroundVariant: { Dots: 'dots', Lines: 'lines', Cross: 'cross' },
}))
```

### MSW for API Mocking
```typescript
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Override for specific test:
server.use(
  http.get('/api/resource', () => {
    return HttpResponse.json({ data: 'mocked' })
  })
)
```
