---
description: Pre-commit quality gate. Run this before committing, pushing, or submitting a PR to ensure all tests pass, coverage thresholds are met, lint is clean, and code is formatted.
---

# Quality Gate — Pre-Commit Checks

Run all validation steps before any commit or PR.

---

## Step 1 — TypeScript Compilation

// turbo
1. Type-check the project:
```bash
npx tsc --noEmit 2>&1 | tail -20
```
2. Fix any type errors before proceeding.

---

## Step 2 — Lint

// turbo
3. Run ESLint:
```bash
npx next lint --quiet
```
4. Fix any lint errors.

---

## Step 3 — Format Check

// turbo
5. Run Prettier check:
```bash
npx prettier --check "src/**/*.{ts,tsx}" "__tests__/**/*.{ts,tsx}"
```
6. If files need formatting:
```bash
npx prettier --write "src/**/*.{ts,tsx}" "__tests__/**/*.{ts,tsx}"
```

---

## Step 4 — Unit Tests with Coverage

// turbo
7. Run unit tests with coverage:
```bash
npx vitest run --coverage 2>&1 | tail -35
```
8. Verify:
   - All tests pass
   - Coverage thresholds met (80% lines, functions, branches, statements)
9. If coverage is below threshold, identify uncovered files and write additional tests before proceeding.

---

## Step 5 — Integration Tests (if applicable)

// turbo
10. Run integration tests:
```bash
npx vitest run --config vitest.integration.config.ts 2>&1 | tail -20
```
11. All integration tests must pass.

---

## Step 6 — E2E Tests (if applicable)

12. Run E2E tests on Chromium:
```bash
npx playwright test --project=chromium 2>&1 | tail -20
```
13. All E2E tests must pass.

---

## Step 7 — Summary

14. Report results to the user:
    - TypeScript: ✅/❌
    - Lint: ✅/❌
    - Format: ✅/❌
    - Unit tests: X passed / Y total
    - Coverage: lines%, functions%, branches%, statements%
    - Integration tests: X passed / Y total (or N/A)
    - E2E tests: X passed / Y total (or N/A)
15. If any step fails, **do not commit**. Fix issues first.
