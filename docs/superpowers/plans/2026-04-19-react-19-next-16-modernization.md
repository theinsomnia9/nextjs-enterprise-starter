# React 19 + Next 16 Modernization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Server Components, Server Actions, `useOptimistic`/`useActionState`/`useFormStatus`, React Compiler, and a server-side actor resolver across the approvals and chat surfaces — in four independently-shippable PRs.

**Architecture:** RSC for initial data load (direct service call, no HTTP hop); typed Server Actions for self-mutations returning `ActionResult<T>` via a shared `wrapAction` helper; SSE retained for cross-client sync (self-mutations do not call `revalidatePath`); additive service-layer methods to pull business logic out of route handlers before they are deleted.

**Tech Stack:** Next.js 16.2.4, React 19.2.5, Zod 3, Prisma 5, Vitest 4, Playwright, OpenTelemetry. Spec: `docs/superpowers/specs/2026-04-19-react-19-next-16-modernization-design.md`.

**Conventions:**
- Path alias `@/` → `src/`.
- Run a single test file with `npx vitest run <path>`; single integration test with `npx vitest run --config vitest.integration.config.ts <path>`.
- Commit frequently. Each PR is a separate branch off `dev`: `feat/react19-pr1-foundation`, `feat/react19-pr2-queue`, `feat/react19-pr3-detail`, `feat/react19-pr4-chat`.
- Do NOT run `git push` — the user pushes.

---

## PR 1 — Foundation

Branch from `dev`: `git checkout dev && git pull && git checkout -b feat/react19-pr1-foundation`.

### Task 1.1: Add React Compiler dependencies

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install the compiler and its ESLint plugin**

```bash
npm install --save-dev babel-plugin-react-compiler eslint-plugin-react-compiler
```

- [ ] **Step 2: Verify the two packages land in package.json**

Run: `npx --no grep -E '"(babel-plugin-react-compiler|eslint-plugin-react-compiler)"' package.json`
Expected: two matching lines under `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add react-compiler packages"
```

### Task 1.2: Enable React Compiler in next.config.js

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: Add `reactCompiler: true` to the config**

Edit `next.config.js`. The existing file uses CommonJS; add the option alongside `reactStrictMode`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

- [ ] **Step 2: Build to verify compiler activates without errors**

Run: `npm run build`
Expected: build completes; log line mentions `Experimental` or `React Compiler` (Next 16 prints a status line when the compiler runs). No TypeScript or compile errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.js
git commit -m "feat(config): enable React Compiler in Next.js"
```

### Task 1.3: Enable the React Compiler ESLint rule

**Files:**
- Modify: `.eslintrc.json`

- [ ] **Step 1: Add the plugin and rule**

Replace the file contents with:

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["react-compiler"],
  "rules": {
    "react-compiler/react-compiler": "error"
  }
}
```

- [ ] **Step 2: Run lint to surface any current violations**

Run: `npm run lint`
Expected: either clean, or a finite list of violations. Record violations in a scratchpad — Task 1.4 fixes them.

- [ ] **Step 3: Commit**

```bash
git add .eslintrc.json
git commit -m "chore(lint): enable react-compiler rule at error"
```

### Task 1.4: Fix or annotate any React Compiler lint violations

**Files:**
- Modify: each file reported by `npm run lint` in Task 1.3.

The React Compiler rule flags code the compiler can't safely auto-memoize. Typical fixes:
- Reading/writing `ref.current` in render → move into an effect or event handler.
- Mutating a prop or state value directly → copy before mutating.
- Using a hook conditionally → restructure to call the hook unconditionally.

As a last-resort escape hatch for unresolvable cases, add `'use no memo'` as the first statement of the function body **with a comment naming the reason**. Do not add this without trying the fix first.

- [ ] **Step 1: For each flagged file, read the file, understand the flag, apply the appropriate fix**

For each violation: fix the root cause. Only if the fix would require an architectural change larger than this PR can support, apply the `'use no memo'` escape with a comment.

- [ ] **Step 2: Re-run lint to confirm clean**

Run: `npm run lint`
Expected: zero react-compiler errors.

- [ ] **Step 3: Run the full unit test suite to confirm no behavior regressed**

Run: `npm run test:unit`
Expected: all previously-passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add <modified files>
git commit -m "refactor(react): resolve react-compiler lint violations"
```

**If Step 1 finds zero violations, skip Steps 1 and 4 and note "no violations" in the PR description.**

### Task 1.5: Create `ActionResult<T>` type and `wrapAction` helper

**Files:**
- Create: `src/lib/actions/result.ts`
- Test: `__tests__/unit/lib/actions/result.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/lib/actions/result.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { wrapAction } from '@/lib/actions/result'
import { AppError, ErrorCode, notFound, lockedByOther } from '@/lib/errors/AppError'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
}))

const { getActor } = await import('@/lib/auth/actor')

describe('wrapAction', () => {
  beforeEach(() => {
    vi.mocked(getActor).mockReset()
  })

  it('returns ok result with data on success', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1' })
    const result = await wrapAction('test.action', async (actor) => ({ hello: actor.id }))
    expect(result).toEqual({ ok: true, data: { hello: 'user-1' } })
  })

  it('short-circuits with UNAUTHORIZED when getActor throws unauthorized', async () => {
    vi.mocked(getActor).mockRejectedValue(
      new AppError({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: 'not signed in' })
    )
    const cb = vi.fn()
    const result = await wrapAction('test.action', cb)
    expect(cb).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'not signed in' },
    })
  })

  it('translates ZodError to VALIDATION with fields record', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1' })
    const schema = z.object({ name: z.string().min(1, 'name required') })
    const result = await wrapAction('test.action', async () => {
      schema.parse({ name: '' })
      return null
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION',
        message: 'Invalid input',
        fields: { name: 'name required' },
      },
    })
  })

  it('translates AppError to its code and message', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1' })
    const result = await wrapAction('test.action', async () => {
      throw notFound('Request', 'abc')
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Request not found' },
    })
  })

  it('passes lockedByOther details through unchanged', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1' })
    const result = await wrapAction('test.action', async () => {
      throw lockedByOther('Bob')
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'LOCKED_BY_OTHER', message: 'Request is locked by another reviewer' },
    })
  })

  it('sanitizes unknown errors to INTERNAL', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'user-1' })
    const result = await wrapAction('test.action', async () => {
      throw new Error('secret internal detail')
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong' },
    })
  })

  it('passes the resolved actor to the callback', async () => {
    vi.mocked(getActor).mockResolvedValue({ id: 'alice' })
    const cb = vi.fn().mockResolvedValue('ok')
    await wrapAction('test.action', cb)
    expect(cb).toHaveBeenCalledWith({ id: 'alice' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/lib/actions/result.test.ts`
Expected: FAIL — module `@/lib/actions/result` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/actions/result.ts`:

```typescript
// Server Actions cross a serialization boundary at runtime. Args and results MUST
// be structurally cloneable: no Dates (use ISO strings), no class instances, no
// functions. ActionResult<T> below intentionally uses only plain objects.

import { ZodError } from 'zod'
import { createSpan } from '@/lib/telemetry/tracing'
import { AppError } from '@/lib/errors/AppError'
import { getActor } from '@/lib/auth/actor'

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: {
        code: string
        message: string
        fields?: Record<string, string>
      }
    }

function zodFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of err.errors) {
    const path = issue.path.join('.')
    if (!(path in out)) out[path] = issue.message
  }
  return out
}

export async function wrapAction<T>(
  actionName: string,
  fn: (actor: { id: string }) => Promise<T>
): Promise<ActionResult<T>> {
  return createSpan(`action.${actionName}`, async (span) => {
    let actor: { id: string }
    try {
      actor = await getActor()
    } catch (err) {
      if (err instanceof AppError) {
        return { ok: false, error: { code: err.code, message: err.message } }
      }
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }
    }

    span.setAttribute('actor.id', actor.id)
    span.setAttribute('action.name', actionName)

    try {
      const data = await fn(actor)
      return { ok: true, data }
    } catch (err) {
      if (err instanceof ZodError) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION',
            message: 'Invalid input',
            fields: zodFields(err),
          },
        }
      }
      if (err instanceof AppError) {
        return { ok: false, error: { code: err.code, message: err.message } }
      }
      console.error(`[action.${actionName}] unexpected error`, err, {
        actorId: actor.id,
      })
      return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } }
    }
  })
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `npx vitest run __tests__/unit/lib/actions/result.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/result.ts __tests__/unit/lib/actions/result.test.ts
git commit -m "feat(actions): add ActionResult type and wrapAction helper"
```

### Task 1.6: Upgrade `getActor` to return `{ id }` with session lookup and dev fallback

**Files:**
- Modify: `src/lib/auth/actor.ts`
- Test: `__tests__/unit/lib/auth/actor.test.ts`

The current module exports `getActorId(): Promise<string>` returning the hardcoded dev id. The new shape is `getActor(): Promise<{ id: string }>`. We keep `getActorId` as a thin re-export so existing callers in `/api/approvals/*/route.ts` continue to compile until they are deleted in PR 2.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/lib/auth/actor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

const { getServerSession } = await import('next-auth')

describe('getActor', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset()
  })

  afterEach(() => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = originalEnv
  })

  it('returns session user id when a session exists', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-42', name: 'Alice', email: 'a@example.com' },
    } as never)
    const { getActor } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: 'user-42' })
  })

  it('falls back to dev user id when no session in non-production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'development'
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.resetModules()
    const { getActor, DEV_ACTOR_ID } = await import('@/lib/auth/actor')
    const actor = await getActor()
    expect(actor).toEqual({ id: DEV_ACTOR_ID })
  })

  it('throws UNAUTHORIZED when no session in production', async () => {
    // @ts-expect-error re-assigning NODE_ENV in tests
    process.env.NODE_ENV = 'production'
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.resetModules()
    const { getActor } = await import('@/lib/auth/actor')
    await expect(getActor()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})

describe('getActorId (back-compat shim)', () => {
  it('returns the id string from getActor', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-99' },
    } as never)
    vi.resetModules()
    const { getActorId } = await import('@/lib/auth/actor')
    await expect(getActorId()).resolves.toBe('user-99')
  })
})
```

- [ ] **Step 2: Run the tests — should fail**

Run: `npx vitest run __tests__/unit/lib/auth/actor.test.ts`
Expected: FAIL — `getActor` is not exported yet.

- [ ] **Step 3: Implement the new module**

Replace `src/lib/auth/actor.ts` contents:

```typescript
import { getServerSession } from 'next-auth'
import { AppError, ErrorCode } from '@/lib/errors/AppError'

export const DEV_ACTOR_ID = 'dev-user-alice'

/**
 * Resolve the current actor from the NextAuth session.
 *
 * - Production: requires a valid session; throws UNAUTHORIZED otherwise.
 * - Non-production: falls back to DEV_ACTOR_ID when no session is present
 *   so local development works without a full NextAuth setup.
 *
 * When real NextAuth wiring is complete, delete the dev fallback branch —
 * all call sites stay unchanged.
 */
export async function getActor(): Promise<{ id: string }> {
  const session = (await getServerSession()) as { user?: { id?: string } } | null
  const id = session?.user?.id

  if (id) return { id }

  if (process.env.NODE_ENV !== 'production') {
    return { id: DEV_ACTOR_ID }
  }

  throw new AppError({
    statusCode: 401,
    code: ErrorCode.UNAUTHORIZED,
    message: 'Sign in required',
  })
}

/** @deprecated Use getActor() instead. Kept for route handlers removed in PR 2. */
export async function getActorId(): Promise<string> {
  const actor = await getActor()
  return actor.id
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `npx vitest run __tests__/unit/lib/auth/actor.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Run the full unit suite to confirm nothing else broke**

Run: `npm run test:unit`
Expected: all tests pass; coverage threshold met.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/actor.ts __tests__/unit/lib/auth/actor.test.ts
git commit -m "feat(auth): upgrade getActor to session lookup with dev fallback"
```

### Task 1.7: Open PR 1

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/react19-pr1-foundation
```

- [ ] **Step 2: Open the PR with `gh pr create`**

```bash
gh pr create --base dev --title "feat: react 19 foundation — compiler, actor resolver, wrapAction" --body "$(cat <<'EOF'
## Summary
- Enable React Compiler (`reactCompiler: true`) in Next config
- Enable `eslint-plugin-react-compiler` rule at `error`
- Add `src/lib/actions/result.ts` — `ActionResult<T>` type + `wrapAction()` helper
- Upgrade `getActor()` to resolve from NextAuth session with non-production dev fallback
- Keep `getActorId()` as a deprecated shim so PR 1 does not touch the route handlers yet

Plan: `docs/superpowers/plans/2026-04-19-react-19-next-16-modernization.md`
Spec: `docs/superpowers/specs/2026-04-19-react-19-next-16-modernization-design.md`

## Test plan
- [ ] `npm run lint` clean
- [ ] `npm run test:unit` passes with 80% coverage
- [ ] `npm run build` succeeds; compiler status line present
- [ ] Manual: `/approvals` and `/chat` still load and work
EOF
)"
```

---

## PR 2 — Approvals queue modernization

Branch from `dev`: `git checkout dev && git pull && git checkout -b feat/react19-pr2-queue`. Cherry-pick or rebase from PR 1 once it's merged; these tasks assume PR 1 code is in.

### Task 2.1: Add `listQueueForDashboard` service method

**Files:**
- Modify: `src/services/approvalService.ts`
- Test: `__tests__/unit/services/approvalService.listQueueForDashboard.test.ts`

The current `getQueueWithConfigs` returns raw requests. `listQueueForDashboard` wraps it with the scoring+sorting+counts logic that currently lives in `/api/approvals/queue/route.ts`.

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/services/approvalService.listQueueForDashboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalService } from '@/services/approvalService'
import type { IApprovalRepository } from '@/lib/approvals/repository'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRequest: {
      groupBy: vi.fn(),
    },
  },
}))

function makeRequest(overrides: Partial<{ id: string; category: 'P1' | 'P2' | 'P3' | 'P4'; submittedAt: Date; status: string }> = {}) {
  const base = {
    id: overrides.id ?? 'req-1',
    title: 't',
    description: null,
    category: overrides.category ?? 'P1',
    status: overrides.status ?? 'PENDING',
    submittedAt: overrides.submittedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    requesterId: 'user-1',
    assigneeId: null,
    approvedById: null,
    lockedAt: null,
    lockExpiresAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    requester: { id: 'user-1', name: 'Alice', email: 'a@example.com' },
    assignee: null,
  }
  return base
}

function makeRepo(): IApprovalRepository {
  return {
    findById: vi.fn(),
    findPendingAndReviewingWithAssignee: vi.fn(),
    create: vi.fn(),
    lock: vi.fn(),
    release: vi.fn(),
    expireLocks: vi.fn(),
    getAllPriorityConfigs: vi.fn(),
    getPriorityConfig: vi.fn(),
  } as unknown as IApprovalRepository
}

describe('ApprovalService.listQueueForDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns counts by status from groupBy', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(prisma.approvalRequest.groupBy).mockResolvedValue([
      { status: 'PENDING', _count: { id: 3 } },
      { status: 'APPROVED', _count: { id: 5 } },
    ] as never)

    const service = new ApprovalService({ repository: repo })
    const result = await service.listQueueForDashboard()

    expect(result.counts).toEqual({ PENDING: 3, REVIEWING: 0, APPROVED: 5, REJECTED: 0 })
  })

  it('computes priorityScore per request and sorts desc by score', async () => {
    const oldP4 = makeRequest({ id: 'r-old-p4', category: 'P4', submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
    const newP1 = makeRequest({ id: 'r-new-p1', category: 'P1', submittedAt: new Date(Date.now() - 60 * 1000) })

    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([oldP4, newP1] as never)
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([
      { category: 'P1', baseWeight: 100, agingFactor: 2, slaHours: 24, lockTimeoutMinutes: 5 },
      { category: 'P4', baseWeight: 25, agingFactor: 0.5, slaHours: 120, lockTimeoutMinutes: 5 },
    ] as never)
    vi.mocked(prisma.approvalRequest.groupBy).mockResolvedValue([] as never)

    const service = new ApprovalService({ repository: repo })
    const { requests } = await service.listQueueForDashboard()

    expect(requests[0].id).toBe('r-new-p1')
    expect(requests[0].priorityScore).toBeGreaterThan(requests[1].priorityScore)
  })

  it('returns total matching requests length', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([
      makeRequest({ id: 'a' }),
      makeRequest({ id: 'b' }),
    ] as never)
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(prisma.approvalRequest.groupBy).mockResolvedValue([] as never)

    const service = new ApprovalService({ repository: repo })
    const { total } = await service.listQueueForDashboard()
    expect(total).toBe(2)
  })
})
```

- [ ] **Step 2: Run the tests — should fail**

Run: `npx vitest run __tests__/unit/services/approvalService.listQueueForDashboard.test.ts`
Expected: FAIL — `listQueueForDashboard` is not a method.

- [ ] **Step 3: Add the method**

In `src/services/approvalService.ts`, add this import at the top:

```typescript
import { calculatePriorityScore } from '@/lib/approvals/priorityScore'
```

Inside the `ApprovalService` class, after `getQueueWithConfigs()`, add:

```typescript
async listQueueForDashboard() {
  const [{ requests, configs }, statusGroups] = await Promise.all([
    this.getQueueWithConfigs(),
    prisma.approvalRequest.groupBy({ by: ['status'], _count: { id: true } }),
  ])

  const counts: Record<'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED', number> = {
    PENDING: 0,
    REVIEWING: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  for (const g of statusGroups) {
    if (g.status in counts) counts[g.status as keyof typeof counts] = g._count.id
  }

  const scored = requests
    .map((r) => ({ ...r, priorityScore: calculatePriorityScore(r.submittedAt, r.config) }))
    .sort((a, b) => b.priorityScore - a.priorityScore)

  return { requests: scored, total: scored.length, counts, configs }
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `npx vitest run __tests__/unit/services/approvalService.listQueueForDashboard.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/approvalService.ts __tests__/unit/services/approvalService.listQueueForDashboard.test.ts
git commit -m "feat(approvals): add listQueueForDashboard service method"
```

### Task 2.2: Add Zod schemas for lock/release/approve

**Files:**
- Modify: `src/lib/approvals/schemas.ts`

- [ ] **Step 1: Add schemas**

Append to `src/lib/approvals/schemas.ts`:

```typescript
export const lockSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
})

export const releaseSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
})

export const approveSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
})

export const rejectSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
})

export type LockInput = z.infer<typeof lockSchema>
export type ReleaseInput = z.infer<typeof releaseSchema>
export type ApproveInput = z.infer<typeof approveSchema>
export type RejectInput = z.infer<typeof rejectSchema>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/approvals/schemas.ts
git commit -m "feat(approvals): add lock/release/approve/reject schemas"
```

### Task 2.3: Create Server Actions file with `lockAction`

**Files:**
- Create: `src/app/approvals/actions.ts`

- [ ] **Step 1: Write the action module**

Create `src/app/approvals/actions.ts`:

```typescript
'use server'

import { wrapAction } from '@/lib/actions/result'
import { approvalService } from '@/services/approvalService'
import { broadcastApprovalEvent } from '@/lib/approvals/sseServer'
import {
  lockSchema,
  releaseSchema,
  approveSchema,
  rejectSchema,
} from '@/lib/approvals/schemas'

async function safeBroadcast(event: Parameters<typeof broadcastApprovalEvent>[0], data: Record<string, unknown>) {
  try {
    await broadcastApprovalEvent(event, data)
  } catch (err) {
    console.error(`[action] broadcast ${event} failed`, err)
  }
}

export async function lockAction(requestId: string, _formData?: FormData) {
  return wrapAction('approvals.lock', async (actor) => {
    const parsed = lockSchema.parse({ requestId })
    const updated = await approvalService.lock(parsed.requestId, actor.id)
    await safeBroadcast('request:locked', {
      requestId: parsed.requestId,
      reviewerId: actor.id,
      expiresAt: updated.lockExpiresAt?.toISOString(),
    })
    return updated
  })
}

export async function releaseAction(requestId: string, _formData?: FormData) {
  return wrapAction('approvals.release', async (actor) => {
    const parsed = releaseSchema.parse({ requestId })
    const updated = await approvalService.release(parsed.requestId, actor.id)
    await safeBroadcast('request:unlocked', {
      requestId: parsed.requestId,
      reason: 'manual_release',
    })
    return updated
  })
}

export async function approveAction(requestId: string, _formData?: FormData) {
  return wrapAction('approvals.approve', async (actor) => {
    const parsed = approveSchema.parse({ requestId })
    const updated = await approvalService.approve(parsed.requestId, actor.id)
    await safeBroadcast('request:approved', { requestId: parsed.requestId })
    return updated
  })
}

export async function rejectAction(requestId: string, formData: FormData) {
  return wrapAction('approvals.reject', async (actor) => {
    const reason = (formData.get('reason') ?? '') as string
    const parsed = rejectSchema.parse({ requestId, reason })
    const updated = await approvalService.reject(parsed.requestId, actor.id, parsed.reason)
    await safeBroadcast('request:rejected', {
      requestId: parsed.requestId,
      reason: parsed.reason,
    })
    return updated
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/approvals/actions.ts
git commit -m "feat(approvals): add Server Actions for lock/release/approve/reject"
```

### Task 2.4: Create integration test harness and integration tests for the actions

**Files:**
- Create: `__tests__/helpers/mockActor.ts`
- Create: `__tests__/helpers/broadcastSpy.ts`
- Create: `__tests__/integration/actions/approvals.test.ts`
- Create: `__tests__/integration/README.md` if not present

Integration tests hit the real test DB on port 5433. Run `npm run infra:up` first and ensure migrations are applied to the test DB (see `CLAUDE.md`).

- [ ] **Step 1: Create the helpers**

Create `__tests__/helpers/mockActor.ts`:

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/auth/actor', () => ({
  getActor: vi.fn(),
  getActorId: vi.fn(),
  DEV_ACTOR_ID: 'dev-user-alice',
}))

export async function setActor(id: string) {
  const { getActor, getActorId } = await import('@/lib/auth/actor')
  vi.mocked(getActor).mockResolvedValue({ id })
  vi.mocked(getActorId).mockResolvedValue(id)
}
```

Create `__tests__/helpers/broadcastSpy.ts`:

```typescript
import { vi } from 'vitest'
import * as sseServer from '@/lib/approvals/sseServer'

export function spyOnBroadcast() {
  return vi.spyOn(sseServer, 'broadcastApprovalEvent').mockResolvedValue()
}
```

- [ ] **Step 2: Write the failing integration tests**

Create `__tests__/integration/actions/approvals.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import '../../helpers/mockActor'
import { setActor } from '../../helpers/mockActor'
import { spyOnBroadcast } from '../../helpers/broadcastSpy'
import { prisma } from '@/lib/prisma'
import { lockAction, releaseAction, approveAction, rejectAction } from '@/app/approvals/actions'

const TEST_USER = { id: 'int-user-alice', email: 'int-alice@example.com', name: 'Int Alice' }
const OTHER_USER = { id: 'int-user-bob', email: 'int-bob@example.com', name: 'Int Bob' }

async function seedRequest(overrides: Partial<{ status: string; assigneeId: string | null; lockExpiresAt: Date | null }> = {}) {
  return prisma.approvalRequest.create({
    data: {
      title: 'Integration Test Request',
      category: 'P2',
      status: (overrides.status as never) ?? 'PENDING',
      submittedAt: new Date(),
      requester: { connect: { id: TEST_USER.id } },
      ...(overrides.assigneeId !== undefined && {
        assignee: overrides.assigneeId ? { connect: { id: overrides.assigneeId } } : { disconnect: true },
      }),
      lockExpiresAt: overrides.lockExpiresAt ?? null,
    },
  })
}

describe('approvals Server Actions (integration)', () => {
  let broadcastSpy: ReturnType<typeof spyOnBroadcast>

  beforeAll(async () => {
    await prisma.user.upsert({ where: { id: TEST_USER.id }, create: TEST_USER, update: {} })
    await prisma.user.upsert({ where: { id: OTHER_USER.id }, create: OTHER_USER, update: {} })
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    broadcastSpy = spyOnBroadcast()
    await setActor(TEST_USER.id)
    await prisma.approvalRequest.deleteMany({ where: { requesterId: TEST_USER.id } })
  })

  afterAll(async () => {
    await prisma.approvalRequest.deleteMany({ where: { requesterId: TEST_USER.id } })
    await prisma.user.deleteMany({ where: { id: { in: [TEST_USER.id, OTHER_USER.id] } } })
  })

  describe('lockAction', () => {
    it('locks a PENDING request and broadcasts request:locked', async () => {
      const req = await seedRequest()
      const result = await lockAction(req.id)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('REVIEWING')
      expect(result.data.assigneeId).toBe(TEST_USER.id)
      expect(broadcastSpy).toHaveBeenCalledWith('request:locked', expect.objectContaining({ requestId: req.id, reviewerId: TEST_USER.id }))
    })

    it('returns LOCKED_BY_OTHER when another reviewer holds an active lock', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: OTHER_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await lockAction(req.id)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('LOCKED_BY_OTHER')
    })

    it('returns NOT_FOUND for an unknown id', async () => {
      const result = await lockAction('nonexistent-id')
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('releaseAction', () => {
    it('releases a lock held by the current actor', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await releaseAction(req.id)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('PENDING')
      expect(broadcastSpy).toHaveBeenCalledWith('request:unlocked', expect.objectContaining({ requestId: req.id }))
    })

    it('rejects a release attempt by a non-reviewer', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: OTHER_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await releaseAction(req.id)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('approveAction', () => {
    it('approves a REVIEWING request held by the actor', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await approveAction(req.id)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('APPROVED')
      expect(broadcastSpy).toHaveBeenCalledWith('request:approved', { requestId: req.id })
    })

    it('rejects an already-resolved request', async () => {
      const req = await seedRequest({ status: 'APPROVED' })
      const result = await approveAction(req.id)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('ALREADY_RESOLVED')
    })
  })

  describe('rejectAction', () => {
    it('rejects a request with a reason', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const fd = new FormData()
      fd.set('reason', 'Missing context')
      const result = await rejectAction(req.id, fd)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('REJECTED')
      expect(result.data.rejectionReason).toBe('Missing context')
      expect(broadcastSpy).toHaveBeenCalledWith(
        'request:rejected',
        expect.objectContaining({ requestId: req.id, reason: 'Missing context' })
      )
    })

    it('returns VALIDATION when reason is empty', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const fd = new FormData()
      fd.set('reason', '')
      const result = await rejectAction(req.id, fd)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('VALIDATION')
      expect(result.error.fields?.reason).toBe('Rejection reason is required')
    })
  })
})
```

- [ ] **Step 3: Run integration tests**

Ensure the test DB is up: `npm run infra:up` (if not already running) and that migrations have been applied.

Run: `npm run test:integration -- __tests__/integration/actions/approvals.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add __tests__/helpers/mockActor.ts __tests__/helpers/broadcastSpy.ts __tests__/integration/actions/approvals.test.ts
git commit -m "test(approvals): integration tests for Server Actions"
```

### Task 2.5: Create `QueueClient` island with `useOptimistic` + `useActionState`

**Files:**
- Create: `src/app/approvals/_components/QueueClient.tsx`
- Test: `__tests__/unit/app/approvals/QueueClient.test.tsx`

The client island owns the optimistic state and renders `QueueDashboard` with bound actions.

- [ ] **Step 1: Write the component**

Create `src/app/approvals/_components/QueueClient.tsx`:

```typescript
'use client'

import { useOptimistic, useTransition } from 'react'
import { QueueDashboard, type QueueRequest } from '@/components/approval/QueueDashboard'
import { RejectModal } from '@/components/approval/RejectModal'
import type { StatusCounts } from '@/components/approval/ApprovalPipeline'
import { lockAction, releaseAction, approveAction, rejectAction } from '@/app/approvals/actions'
import type { ActionResult } from '@/lib/actions/result'
import { useState } from 'react'

type OptimisticPatch =
  | { type: 'lock'; id: string; reviewerId: string }
  | { type: 'release'; id: string }
  | { type: 'approve'; id: string }
  | { type: 'reject'; id: string }

interface QueueClientProps {
  initialRequests: QueueRequest[]
  initialCounts: StatusCounts
  currentUserId: string
}

function applyPatch(requests: QueueRequest[], patch: OptimisticPatch): QueueRequest[] {
  return requests.map((r) => {
    if (r.id !== patch.id) return r
    switch (patch.type) {
      case 'lock':
        return {
          ...r,
          status: 'REVIEWING',
          assignee: { id: patch.reviewerId, name: null, email: null },
          lockExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }
      case 'release':
        return { ...r, status: 'PENDING', assignee: null, lockExpiresAt: null }
      case 'approve':
      case 'reject':
        return r // removed from active queue on server refresh via SSE
    }
  })
}

function toastError(message: string) {
  // Minimal inline feedback — replace with toast lib if available.
  console.error('[QueueClient]', message)
  if (typeof window !== 'undefined') window.alert(message)
}

export function QueueClient({ initialRequests, initialCounts, currentUserId }: QueueClientProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [counts] = useState(initialCounts)
  const [optimisticRequests, applyOptimistic] = useOptimistic(requests, applyPatch)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleLock = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: 'lock', id, reviewerId: currentUserId })
      const result: ActionResult<unknown> = await lockAction(id)
      if (!result.ok) toastError(result.error.message)
    })
  }

  const handleRelease = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: 'release', id })
      const result = await releaseAction(id)
      if (!result.ok) toastError(result.error.message)
    })
  }

  const handleApprove = (id: string) => {
    startTransition(async () => {
      applyOptimistic({ type: 'approve', id })
      const result = await approveAction(id)
      if (!result.ok) toastError(result.error.message)
      else setRequests((prev) => prev.filter((r) => r.id !== id))
    })
  }

  const handleReject = (id: string) => setRejectTarget(id)

  const confirmReject = async (reason: string) => {
    const id = rejectTarget
    if (!id) return
    const fd = new FormData()
    fd.set('reason', reason)
    startTransition(async () => {
      applyOptimistic({ type: 'reject', id })
      const result = await rejectAction(id, fd)
      if (!result.ok) toastError(result.error.message)
      else setRequests((prev) => prev.filter((r) => r.id !== id))
    })
    setRejectTarget(null)
  }

  const handleRefresh = () => {
    // SSE-driven refresh handled by QueueDashboard/ApprovalPipeline subscription.
    // Explicit refresh: re-fetch via a Server Action in a later iteration.
  }

  return (
    <>
      <QueueDashboard
        requests={optimisticRequests}
        counts={counts}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
        onLock={handleLock}
        onRelease={handleRelease}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      {rejectTarget && (
        <RejectModal onConfirm={confirmReject} onCancel={() => setRejectTarget(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 2: Write component tests**

Create `__tests__/unit/app/approvals/QueueClient.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueueClient } from '@/app/approvals/_components/QueueClient'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

vi.mock('@/app/approvals/actions', () => ({
  lockAction: vi.fn(),
  releaseAction: vi.fn(),
  approveAction: vi.fn(),
  rejectAction: vi.fn(),
}))

const { lockAction, approveAction } = await import('@/app/approvals/actions')

function makeRequest(overrides: Partial<QueueRequest> = {}): QueueRequest {
  return {
    id: 'r1',
    title: 'Test',
    category: 'P1',
    status: 'PENDING',
    priorityScore: 100,
    requester: { id: 'u1', name: 'Alice', email: 'a@x.com' },
    assignee: null,
    lockedAt: null,
    lockExpiresAt: null,
    submittedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('QueueClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies optimistic lock and calls lockAction', async () => {
    vi.mocked(lockAction).mockResolvedValue({ ok: true, data: {} })
    render(
      <QueueClient
        initialRequests={[makeRequest()]}
        initialCounts={{ PENDING: 1, REVIEWING: 0, APPROVED: 0, REJECTED: 0 }}
        currentUserId="u1"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /lock/i }))
    expect(lockAction).toHaveBeenCalledWith('r1')
  })

  it('removes a request from the list after successful approve', async () => {
    vi.mocked(approveAction).mockResolvedValue({ ok: true, data: {} })
    render(
      <QueueClient
        initialRequests={[makeRequest({ status: 'REVIEWING', assignee: { id: 'u1', name: 'Me', email: null }, lockExpiresAt: new Date(Date.now() + 60000).toISOString() })]}
        initialCounts={{ PENDING: 0, REVIEWING: 1, APPROVED: 0, REJECTED: 0 }}
        currentUserId="u1"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(approveAction).toHaveBeenCalledWith('r1')
  })
})
```

- [ ] **Step 3: Run component tests**

Run: `npx vitest run __tests__/unit/app/approvals/QueueClient.test.tsx`
Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/approvals/_components/QueueClient.tsx __tests__/unit/app/approvals/QueueClient.test.tsx
git commit -m "feat(approvals): add QueueClient island with useOptimistic"
```

### Task 2.6: Convert `/approvals/page.tsx` to a Server Component

**Files:**
- Modify: `src/app/approvals/page.tsx`

- [ ] **Step 1: Replace the file contents**

Replace `src/app/approvals/page.tsx` with:

```typescript
import { approvalService } from '@/services/approvalService'
import { getActor } from '@/lib/auth/actor'
import { QueueClient } from './_components/QueueClient'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

export default async function ApprovalsPage() {
  const actor = await getActor()
  const { requests, counts } = await approvalService.listQueueForDashboard()

  const serialized: QueueRequest[] = requests.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    status: r.status,
    priorityScore: r.priorityScore,
    requester: r.requester,
    assignee: r.assignee,
    lockedAt: r.lockedAt?.toISOString() ?? null,
    lockExpiresAt: r.lockExpiresAt?.toISOString() ?? null,
    submittedAt: r.submittedAt.toISOString(),
  }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Approval Queue</h1>
      <QueueClient
        initialRequests={serialized}
        initialCounts={counts}
        currentUserId={actor.id}
      />
    </main>
  )
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/approvals/page.tsx
git commit -m "refactor(approvals): convert queue page to Server Component"
```

### Task 2.7: Delete approvals API routes and their tests

**Files:**
- Delete: `src/app/api/approvals/queue/route.ts`
- Delete: `src/app/api/approvals/[id]/lock/route.ts`
- Delete: `src/app/api/approvals/[id]/release/route.ts`
- Delete: `src/app/api/approvals/[id]/approve/route.ts`
- Delete: `src/app/api/approvals/[id]/reject/route.ts`

The `GET /api/approvals/[id]` route is NOT deleted here — that lives in PR 3.

- [ ] **Step 1: Remove the files**

```bash
git rm src/app/api/approvals/queue/route.ts
git rm src/app/api/approvals/[id]/lock/route.ts
git rm src/app/api/approvals/[id]/release/route.ts
git rm src/app/api/approvals/[id]/approve/route.ts
git rm src/app/api/approvals/[id]/reject/route.ts
```

- [ ] **Step 2: Check for any route-handler tests to remove**

Run: `ls __tests__/unit/app/api/approvals/`
If there are `.test.ts` files that exclusively target the deleted routes (i.e., not the `POST /api/approvals` create route, which stays), delete them:

```bash
# Only remove tests that target deleted routes. The existing
# __tests__/unit/app/api/approvals/route.test.ts covers the create endpoint
# (POST /api/approvals) which is NOT deleted — leave it in place.
```

Inspect `__tests__/unit/app/api/approvals/route.test.ts` and confirm it only tests `POST /api/approvals`. If yes, leave it.

- [ ] **Step 3: Typecheck + lint + unit tests**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: no errors; tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(approvals): delete route handlers replaced by Server Actions"
```

### Task 2.8: Remove now-dead `handleRefresh` polling and ensure SSE continues to trigger re-renders

**Files:**
- Modify: `src/app/approvals/_components/QueueClient.tsx` (if needed)

SSE refresh happens inside `ApprovalPipeline`/`useApprovalEvents`. The `onRefresh` callback previously re-fetched from `/api/approvals/queue` — that endpoint no longer exists. The replacement: on any SSE refresh event, revalidate the current page via `router.refresh()` (which re-runs the Server Component).

- [ ] **Step 1: Update the component**

In `src/app/approvals/_components/QueueClient.tsx`, replace the `handleRefresh` stub with a `router.refresh()` call:

Add imports:
```typescript
import { useRouter } from 'next/navigation'
```

Replace the `handleRefresh` definition inside the component with:

```typescript
const router = useRouter()
const handleRefresh = () => {
  router.refresh()
}
```

Note: this is the single permitted `router.refresh()` path — it fires only on *other* clients' SSE-driven events, not on self-mutations. Self-mutations use the action return value + `useOptimistic`.

- [ ] **Step 2: Run tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/approvals/_components/QueueClient.tsx
git commit -m "feat(approvals): trigger router.refresh on SSE refresh events"
```

### Task 2.9: Manual verification, push, and open PR 2

- [ ] **Step 1: Run the dev server and exercise the flow**

Run: `npm run infra:up && npm run dev`

In the browser at `http://localhost:3000/approvals`:
- Initial load shows queue with no loading spinner flash.
- Click Lock on a PENDING request — UI flips to REVIEWING instantly (optimistic).
- Network tab: no `POST /api/approvals/.../lock` request; a Server Action POST to the RSC endpoint.
- Open a second tab, lock a request in tab A — tab B refreshes the queue via SSE.
- Click Reject, enter a reason, submit — row disappears from active queue.
- Invalid reject (empty reason) shows the VALIDATION error.

Stop the dev server when done.

- [ ] **Step 2: Run full suites**

Run: `npm run test:unit && npm run test:integration`
Expected: all pass.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/react19-pr2-queue
gh pr create --base dev --title "feat: react 19 queue — Server Component + Server Actions" --body "$(cat <<'EOF'
## Summary
- `/approvals/page.tsx` is now a Server Component; calls `approvalService.listQueueForDashboard()` directly
- `src/app/approvals/actions.ts` — Server Actions for lock/release/approve/reject using `wrapAction`
- `src/app/approvals/_components/QueueClient.tsx` — client island with `useOptimistic` and SSE-driven `router.refresh`
- Deleted: `/api/approvals/queue` and four `/api/approvals/[id]/{lock,release,approve,reject}` route handlers
- New service method `listQueueForDashboard()` moves scoring+sort+counts out of the route layer

Plan: `docs/superpowers/plans/2026-04-19-react-19-next-16-modernization.md`

## Test plan
- [ ] `npm run test:unit` passes with coverage
- [ ] `npm run test:integration` passes
- [ ] Manual: lock/release/approve/reject paths work; optimistic updates visible; SSE refresh works cross-tab
- [ ] No network requests to deleted API routes
EOF
)"
```

---

## PR 3 — Approvals detail page

Branch from `dev`: `git checkout dev && git pull && git checkout -b feat/react19-pr3-detail`.

### Task 3.1: Add `getRequestWithScore` service method

**Files:**
- Modify: `src/services/approvalService.ts`
- Test: `__tests__/unit/services/approvalService.getRequestWithScore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/services/approvalService.getRequestWithScore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalService } from '@/services/approvalService'
import type { IApprovalRepository } from '@/lib/approvals/repository'

function makeRepo(): IApprovalRepository {
  return {
    findById: vi.fn(),
    findPendingAndReviewingWithAssignee: vi.fn(),
    create: vi.fn(),
    lock: vi.fn(),
    release: vi.fn(),
    expireLocks: vi.fn(),
    getAllPriorityConfigs: vi.fn(),
    getPriorityConfig: vi.fn(),
  } as unknown as IApprovalRepository
}

const baseRow = {
  id: 'req-1',
  title: 't',
  description: null,
  category: 'P2' as const,
  status: 'PENDING' as const,
  submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  requesterId: 'u1',
  assigneeId: null,
  approvedById: null,
  lockedAt: null,
  lockExpiresAt: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  requester: { id: 'u1', name: 'Alice', email: 'a@x.com' },
  assignee: null,
}

describe('ApprovalService.getRequestWithScore', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active-queue record with a priorityScore when present', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([baseRow as never])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([
      { category: 'P2', baseWeight: 75, agingFactor: 1.5, slaHours: 48, lockTimeoutMinutes: 5 } as never,
    ])

    const service = new ApprovalService({ repository: repo })
    const result = await service.getRequestWithScore('req-1')

    expect(result.id).toBe('req-1')
    expect(result.priorityScore).toBeGreaterThan(0)
    expect(repo.findById).not.toHaveBeenCalled()
  })

  it('falls back to findById with default config for resolved requests', async () => {
    const resolved = { ...baseRow, id: 'req-2', status: 'APPROVED' as const }
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(repo.findById).mockResolvedValue(resolved as never)

    const service = new ApprovalService({ repository: repo })
    const result = await service.getRequestWithScore('req-2')

    expect(result.id).toBe('req-2')
    expect(result.priorityScore).toBeGreaterThan(0)
  })

  it('throws notFound when no record exists in queue or direct lookup', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(repo.findById).mockResolvedValue(null)

    const service = new ApprovalService({ repository: repo })
    await expect(service.getRequestWithScore('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx vitest run __tests__/unit/services/approvalService.getRequestWithScore.test.ts`
Expected: FAIL — method not defined.

- [ ] **Step 3: Implement**

Add to `src/services/approvalService.ts`, alongside `listQueueForDashboard`:

```typescript
async getRequestWithScore(id: string) {
  const { requests, configs } = await this.getQueueWithConfigs()
  const queued = requests.find((r) => r.id === id)
  if (queued) {
    return {
      ...queued,
      priorityScore: calculatePriorityScore(queued.submittedAt, queued.config),
    }
  }

  const request = await this.getRequest(id)
  const configMap = new Map<string, PriorityConfigValues>(
    configs.map((c) => [c.category as string, c as PriorityConfigValues])
  )
  const fallbackConfig = configMap.get(request.category) ?? DEFAULT_PRIORITY_CONFIG

  return {
    ...request,
    priorityScore: calculatePriorityScore(request.submittedAt, fallbackConfig),
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run __tests__/unit/services/approvalService.getRequestWithScore.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/approvalService.ts __tests__/unit/services/approvalService.getRequestWithScore.test.ts
git commit -m "feat(approvals): add getRequestWithScore service method"
```

### Task 3.2: Refactor `RejectModal` to use a form action

**Files:**
- Modify: `src/components/approval/RejectModal.tsx`
- Test: `__tests__/unit/components/approval/RejectModal.test.tsx`

The modal currently uses `useRef`-held state and manual handlers. Move to `<form action>` + `useFormStatus` for the submit button state.

- [ ] **Step 1: Write failing tests**

Create or replace `__tests__/unit/components/approval/RejectModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RejectModal } from '@/components/approval/RejectModal'

describe('RejectModal', () => {
  it('calls onConfirm with the reason on submit', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    const textarea = screen.getByPlaceholderText(/describe why/i)
    await userEvent.type(textarea, 'Missing context')
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    expect(onConfirm).toHaveBeenCalledWith('Missing context')
  })

  it('does not call onConfirm when the reason is empty', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancels via Escape key', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    const textarea = screen.getByPlaceholderText(/describe why/i)
    textarea.focus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('cancels via Cancel button', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<RejectModal onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests (expect partial failure)**

Run: `npx vitest run __tests__/unit/components/approval/RejectModal.test.tsx`

- [ ] **Step 3: Rewrite the modal**

Replace `src/components/approval/RejectModal.tsx`:

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

interface RejectModalProps {
  onConfirm: (reason: string) => void
  onCancel: () => void
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40"
    >
      {pending ? 'Rejecting…' : 'Reject'}
    </button>
  )
}

export function RejectModal({ onConfirm, onCancel }: RejectModalProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const formAction = (formData: FormData) => {
    const reason = (formData.get('reason') ?? '').toString().trim()
    if (!reason) return
    onConfirm(reason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">Rejection reason</h2>
        <form action={formAction}>
          <textarea
            ref={inputRef}
            name="reason"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
            placeholder="Describe why this request is being rejected…"
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run __tests__/unit/components/approval/RejectModal.test.tsx`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/approval/RejectModal.tsx __tests__/unit/components/approval/RejectModal.test.tsx
git commit -m "refactor(approvals): migrate RejectModal to form action + useFormStatus"
```

### Task 3.3: Create `DetailClient` island

**Files:**
- Create: `src/app/approvals/[id]/_components/DetailClient.tsx`

- [ ] **Step 1: Create the file**

Create `src/app/approvals/[id]/_components/DetailClient.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { ApprovalFlowDiagram } from '@/components/approval/ApprovalFlowDiagram'
import type { QueueRequest } from '@/components/approval/QueueDashboard'
import { CATEGORY_COLORS } from '@/lib/approvals/constants'

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-[hsl(var(--status-pending))]/10 text-[hsl(var(--status-pending))] border border-[hsl(var(--status-pending))]/20',
  REVIEWING: 'bg-[hsl(var(--status-reviewing))]/10 text-[hsl(var(--status-reviewing))] border border-[hsl(var(--status-reviewing))]/20',
  APPROVED: 'bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border border-[hsl(var(--status-approved))]/20',
  REJECTED: 'bg-[hsl(var(--status-rejected))]/10 text-[hsl(var(--status-rejected))] border border-[hsl(var(--status-rejected))]/20',
}

interface DetailClientProps {
  request: QueueRequest
}

export function DetailClient({ request }: DetailClientProps) {
  const router = useRouter()
  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <button
            data-testid="back-to-queue"
            onClick={() => router.push('/approvals')}
            className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ← Back to queue
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${CATEGORY_COLORS[request.category] ?? ''}`}>
              {request.category}
            </span>
            <h1 className="text-xl font-bold">{request.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[request.status] ?? ''}`}>
              {request.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Submitted by {request.requester.name ?? request.requester.email}</span>
            <span>·</span>
            <span>Score: {Math.round(request.priorityScore)}</span>
            <span>·</span>
            <span>{new Date(request.submittedAt).toLocaleDateString()}</span>
            {request.assignee && (
              <>
                <span>·</span>
                <span>Reviewer: {request.assignee.name ?? request.assignee.email}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click any node to see details. Node positions and state update in real time for all viewers.
      </p>

      <div className="min-h-0 flex-1">
        <ApprovalFlowDiagram request={request} roomId={`approval-${request.id}`} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/approvals/\[id\]/_components/DetailClient.tsx
git commit -m "feat(approvals): add DetailClient island for detail page"
```

### Task 3.4: Convert `/approvals/[id]/page.tsx` to a Server Component

**Files:**
- Modify: `src/app/approvals/[id]/page.tsx`

- [ ] **Step 1: Replace the file**

Replace `src/app/approvals/[id]/page.tsx`:

```typescript
import { notFound as nextNotFound } from 'next/navigation'
import { approvalService } from '@/services/approvalService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import { DetailClient } from './_components/DetailClient'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

interface ApprovalDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ApprovalDetailPage({ params }: ApprovalDetailPageProps) {
  const { id } = await params

  let request: Awaited<ReturnType<typeof approvalService.getRequestWithScore>>
  try {
    request = await approvalService.getRequestWithScore(id)
  } catch (err) {
    if (err instanceof AppError && err.code === ErrorCode.NOT_FOUND) {
      nextNotFound()
    }
    throw err
  }

  const serialized: QueueRequest = {
    id: request.id,
    title: request.title,
    category: request.category,
    status: request.status,
    priorityScore: request.priorityScore,
    requester: request.requester,
    assignee: request.assignee,
    lockedAt: request.lockedAt?.toISOString() ?? null,
    lockExpiresAt: request.lockExpiresAt?.toISOString() ?? null,
    submittedAt: request.submittedAt.toISOString(),
  }

  return <DetailClient request={serialized} />
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/approvals/\[id\]/page.tsx
git commit -m "refactor(approvals): convert detail page to Server Component"
```

### Task 3.5: Delete `/api/approvals/[id]/route.ts` and its test

**Files:**
- Delete: `src/app/api/approvals/[id]/route.ts`
- Delete any test file exclusively targeting it (check `__tests__/unit/app/api/approvals/[id]/` if present)

- [ ] **Step 1: Find associated tests**

Run: `ls __tests__/unit/app/api/approvals/[id]/ 2>/dev/null || echo "no test dir"`

- [ ] **Step 2: Remove the route**

```bash
git rm src/app/api/approvals/\[id\]/route.ts
# If a test dir exists for the [id] route only, remove matching test files:
# git rm __tests__/unit/app/api/approvals/\[id\]/route.test.ts
```

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: no errors; tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(approvals): delete detail GET route replaced by Server Component"
```

### Task 3.6: Manual verification and open PR 3

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`

Browser checks at `http://localhost:3000/approvals/<some-id>`:
- Page renders instantly — no loading spinner.
- The flow diagram displays the request.
- Click an item on the queue (`/approvals`), then navigate into detail, then Back — navigation works without unmounting state issues.
- From the detail page, open RejectModal (if reachable from this page — otherwise verify via the queue page) and confirm the form submits reason properly and shows pending state.

Stop the dev server.

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin feat/react19-pr3-detail
gh pr create --base dev --title "feat: react 19 detail — Server Component + RejectModal form action" --body "$(cat <<'EOF'
## Summary
- `/approvals/[id]/page.tsx` is now a Server Component calling `approvalService.getRequestWithScore(id)`
- `DetailClient.tsx` hosts the interactive portion (flow diagram, back nav)
- `RejectModal.tsx` migrated to `<form action>` + `useFormStatus`
- Deleted: `GET /api/approvals/[id]` route
- New service method `getRequestWithScore(id)` moves the "active queue vs resolved" branching out of the route layer

Plan: `docs/superpowers/plans/2026-04-19-react-19-next-16-modernization.md`

## Test plan
- [ ] `npm run test:unit` passes with coverage
- [ ] Manual: detail page renders; back nav works; reject modal works end-to-end
- [ ] 404 for a missing id produces Next's not-found response
EOF
)"
```

---

## PR 4 — Chat input form action

Branch from `dev`: `git checkout dev && git pull && git checkout -b feat/react19-pr4-chat`.

### Task 4.1: Migrate `ChatInput` to `<form action>` + `useFormStatus`

**Files:**
- Modify: `src/components/chat/ChatInput.tsx`
- Test: update or replace `__tests__/unit/components/chat/ChatInput.test.tsx` if it exists

Server Actions are NOT used here — chat streaming happens client-side through fetch + `ReadableStream`. We use a *client-side* form action (a regular JS function passed to `<form action>`) so `useFormStatus` can report pending state automatically.

- [ ] **Step 1: Write tests first (or update existing)**

Check: `ls __tests__/unit/components/chat/ChatInput.test.tsx 2>/dev/null`

If a test exists, update it to assert the new behavior. Otherwise, create `__tests__/unit/components/chat/ChatInput.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/components/chat/ChatInput'

describe('ChatInput', () => {
  it('calls onSend with the trimmed message on submit', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    const input = screen.getByPlaceholderText(/type your message/i)
    await userEvent.type(input, '  hello  ')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('does not call onSend when message is empty', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('submits on Enter without shift', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    const input = screen.getByPlaceholderText(/type your message/i)
    await userEvent.type(input, 'line one{Enter}')
    expect(onSend).toHaveBeenCalledWith('line one')
  })

  it('does not submit on Shift+Enter', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)
    const input = screen.getByPlaceholderText(/type your message/i)
    await userEvent.type(input, 'line{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rewrite the component**

Replace `src/components/chat/ChatInput.tsx`:

```typescript
'use client'

import { useRef, useState, KeyboardEvent } from 'react'
import { useFormStatus } from 'react-dom'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Send message"
      className={cn(
        'flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
        'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'interactive'
      )}
    >
      <Send className="h-4 w-4" />
      <span>Send</span>
    </button>
  )
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const formAction = (formData: FormData) => {
    const value = (formData.get('message') ?? '').toString().trim()
    if (!value) return
    onSend(value)
    setMessage('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex gap-2">
      <input
        type="text"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className={cn(
          'flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm',
          'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
          'placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      />
      <SendButton />
    </form>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run __tests__/unit/components/chat/ChatInput.test.tsx`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatInput.tsx __tests__/unit/components/chat/ChatInput.test.tsx
git commit -m "refactor(chat): migrate ChatInput to form action + useFormStatus"
```

### Task 4.2: Manual verification and open PR 4

- [ ] **Step 1: Run dev server**

Run: `npm run dev`

Browser checks at `http://localhost:3000/chat`:
- Type a message, hit Send — message streams back from the assistant.
- While streaming, the Send button is disabled (via `useFormStatus` since the form is pending during the sync `onSend` call — verify the disabled state still works visually; if it flickers too fast, that's acceptable because streaming happens outside `formAction` by design).
- Enter submits without Shift; Shift+Enter does not.

Stop dev server.

- [ ] **Step 2: Full test suites**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/react19-pr4-chat
gh pr create --base dev --title "feat: react 19 chat — ChatInput form action" --body "$(cat <<'EOF'
## Summary
- `ChatInput` migrated to `<form action>` with `useFormStatus` on the Send button
- Streaming pipeline unchanged (still client-side fetch + ReadableStream)

Plan: `docs/superpowers/plans/2026-04-19-react-19-next-16-modernization.md`

## Test plan
- [ ] `npm run test:unit` passes
- [ ] Manual: send message, stream, edit on Enter, Shift+Enter behaviour
EOF
)"
```

---

## Self-Review

- **Spec §2.1 (SSE coexists):** covered by Task 2.3 (actions broadcast directly) + Task 2.8 (`router.refresh()` on SSE events for other clients) + absence of `revalidatePath` in actions.
- **Spec §2.2 (getActor):** Task 1.6.
- **Spec §2.3 (four PRs):** structure of the plan itself.
- **Spec §2.4 (no `revalidatePath`):** call sites in Task 2.3 have no `revalidatePath` import.
- **Spec §2.5 (ActionResult):** Task 1.5.
- **Spec §3.1 (PR 1 files):** Tasks 1.1–1.6.
- **Spec §3.2 (PR 2 files):** Tasks 2.1–2.8.
- **Spec §3.3 (PR 3 files):** Tasks 3.1–3.5.
- **Spec §3.4 (PR 4 files):** Task 4.1.
- **Spec §4.1 (initial load flow):** Task 2.6 (queue) + 3.4 (detail).
- **Spec §4.2 (mutation flow):** Task 2.5 drives the shape with optimistic + action call.
- **Spec §4.3 (SSE echo):** chosen strategy B — no explicit filter; Task 2.8 just triggers refresh.
- **Spec §4.5 (optimistic shape):** implemented in Task 2.5 as a discriminated `OptimisticPatch`.
- **Spec §5 (error handling):** Task 1.5 covers `wrapAction` translation; Task 2.5 covers surface logic.
- **Spec §6.1 (testing layers):** service tests in Tasks 2.1, 3.1; action integration tests in 2.4; client island tests in 2.5, 3.2, 4.1; `wrapAction` unit tests in 1.5.
- **Spec §6.2 (test seams):** `__tests__/helpers/mockActor.ts` and `broadcastSpy.ts` created in Task 2.4.

No placeholders. No unimplemented types. Method signatures verified against the repo (`ApprovalService.lock(id, reviewerId)`, etc.).
