---
trigger: always
---

# TDD Agent Rules — Next.js Enterprise Boilerplate

These rules govern ALL code changes in this project. Follow them without exception.

## Core Principle: Tests First, Always

1. **Never write production code without a failing test.**
   - Before creating or modifying any file in `src/`, write or update the corresponding test in `__tests__/`.
   - The only exceptions are: config files, type-only files, and CSS/styling.

2. **Follow Red → Green → Refactor strictly.**
   - RED: Write a test that fails for the right reason.
   - GREEN: Write the minimum implementation to pass.
   - REFACTOR: Clean up while keeping tests green.

## Test Structure Rules

3. **Mirror source paths in test directories:**
   - `src/components/feature/X.tsx` → `__tests__/unit/components/feature/X.test.tsx`
   - `src/lib/X.ts` → `__tests__/unit/lib/X.test.ts`
   - `src/app/api/X/route.ts` → `__tests__/integration/api/X.test.ts`
   - User-facing pages → `__tests__/e2e/X.spec.ts`

4. **Use the project's custom test utilities:**
   - Import `render, screen, fireEvent, waitFor` from `__tests__/setup/test-utils`
   - Use MSW handlers from `__tests__/mocks/handlers/` for API mocking
   - Use `vi.mock()` for module mocking (ReactFlow, next/navigation, etc.)

5. **Every test follows AAA pattern:**
   - Arrange → Act → Assert
   - One assertion concept per test (multiple `expect()` calls are fine if testing the same behavior)
   - Descriptive test names: `it('should display error when email is invalid')`

## Coverage Requirements

6. **New code must achieve ≥ 80% coverage** across lines, functions, branches, and statements.
7. **Test edge cases:** empty inputs, null/undefined, error states, boundary values.
8. **Test error paths:** not just happy paths. Every `try/catch`, conditional branch, and error return needs test coverage.

## Code Quality Rules

9. **TypeScript strict mode:** No `any` types unless there is no alternative (e.g., third-party library gap). Use `unknown` and narrow with type guards instead.
10. **Use project aliases:** Import from `@/` (maps to `src/`), never relative paths from test files to source.
11. **Use `cn()` from `@/lib/utils`** for all className merging.
12. **Validate inputs with Zod** on all API route handlers.
13. **No `console.log` in production code.** Use OpenTelemetry spans and events instead.

## Observability Rules

14. **Wrap API route handlers** with OpenTelemetry spans using `createSpan()` from `@/lib/telemetry/tracing`.
15. **Follow span naming conventions:**
    - API routes: `http.{METHOD}.{route}` (e.g., `http.POST./api/workflows`)
    - Database ops: `db.{operation}.{table}` (e.g., `db.select.users`)
    - Business logic: `{domain}.{operation}` (e.g., `workflow.execute`)
16. **Add semantic attributes** (not arbitrary keys): `user.id`, `workflow.id`, `http.status_code`, etc.
17. **Record exceptions on spans** in catch blocks via `span.recordException(error)`.

## Component Rules

18. **Client components** (`'use client'`) must have unit tests that verify:
    - Rendering (correct elements appear)
    - User interactions (click, input, submit)
    - State changes (conditional rendering)
    - Accessibility (roles, labels)
19. **Add `data-testid`** to key interactive elements for E2E testability.
20. **Server components and pages** should be tested via E2E specs.

## API Route Rules

21. **Every API route** must have:
    - Input validation with Zod
    - Proper HTTP status codes (200, 201, 400, 401, 404, 500)
    - OpenTelemetry span wrapping
    - Integration tests covering success and error cases
22. **Use `NextResponse.json()`** for all API responses.

## Before Completing Any Task

23. Run `npx vitest run` and confirm all tests pass.
24. Run `npx next lint --quiet` and confirm zero errors.
25. If the task involves user-facing changes, run `npx playwright test --project=chromium`.
26. Report: tests written, tests passing, coverage for new files, lint status.
