# React 19 + Next 16 Modernization — Design

**Date:** 2026-04-19
**Status:** Design approved; ready for implementation plan
**Scope:** Post-upgrade alignment of the approvals and chat surfaces with React 19 and Next.js 16 idioms. Production-ready shape, not a throwaway refactor.

## 1. Background and Goals

The repository recently upgraded to `react@19.2.5` and `next@16.2.4`. The two post-upgrade commits fixed obvious anti-patterns (`ThemeContext.Provider` → `<ThemeContext value>`, `useContext` → `use()`, a derived-state-from-prop issue in `ApprovalPipeline`). Remaining client code still reflects a pre-19, pre-Server-Components style: `'use client'` pages that fetch their own data from sibling API routes, manual pending-state plumbing, no optimistic updates, no React Compiler, and a `CURRENT_USER_ID` constant hard-coded into the approvals page.

Goal: land the remaining React 19 / Next 16 best practices in a shape that is production-ready and scalable, not a playground demo.

Explicitly in scope:
- React Compiler enablement.
- `useActionState`, `useOptimistic`, `useFormStatus` where they replace manual state.
- Server Components for initial page data load.
- Server Actions for mutations.
- A server-side actor resolver so the client stops sending actor ids.

Explicitly out of scope:
- Full NextAuth wiring (sign-in UI, providers, session DB schema). The actor resolver has a one-line swap point for when that work happens.
- Streaming chat refactor. SSE/token streaming is not a form-action pattern.
- Prisma schema changes and repository contract changes. The service gains additive methods to pull business logic out of route handlers, but the underlying data model and existing service methods are unchanged.

## 2. Architectural Decisions

### 2.1 SSE coexists with Server Actions (decision A)

The existing SSE machinery stays. Server Actions become an additional caller of `broadcastApprovalEvent()`, replacing the API routes that previously called it. The mutating client does not call `revalidatePath` — it already has the authoritative return value from the action, and any such revalidation would cause a visible flicker on top of the optimistic update. Other connected clients receive the SSE echo and refresh as they do today.

### 2.2 Server-side actor resolution (decision B)

The client no longer sends actor ids. A `getActor()` helper, server-only, lives at `src/lib/auth/actor.ts`. It prefers the NextAuth session via `await auth()`; in non-production it falls back to the dev user id. Every Server Action calls it via `wrapAction`. When real NextAuth wiring happens later, the dev fallback is removed in one place with no call-site changes.

### 2.3 Layered PR delivery (approach 2)

Four sequenced PRs, each independently mergeable and revertable:

1. **Foundation** — React Compiler on, `getActor()`, lint plugin, strip defensive memoization the compiler flags.
2. **Approvals queue** — `/approvals/page.tsx` to Server Component; four mutation Server Actions; client island with `useOptimistic` and `useActionState`.
3. **Approvals detail** — `/approvals/[id]/page.tsx` to Server Component; `RejectModal` to form action.
4. **Chat input** — `ChatInput` to form action with `useFormStatus`. Streaming remains client.

### 2.4 No `revalidatePath` on self-mutations

This is the load-bearing specific decision inside 2.1. SSE is the refresh mechanism. `useOptimistic` is the instant-feedback mechanism. The action return value is the reconciliation. Three sources of truth for three different observers. Adding `revalidatePath` layers a fourth that duplicates the first.

### 2.5 Uniform `ActionResult<T>` shape

Every Server Action returns a discriminated union:

```typescript
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }
```

Translated at the action boundary by a shared `wrapAction()` helper. No action throws. No client `try/catch`. Error `code` drives UX branching (toast copy, inline field errors, redirects).

## 3. Module and File Layout

### 3.1 PR 1 — Foundation

**Changed:**
- `next.config.ts` — `reactCompiler: true`.
- `package.json` — add `eslint-plugin-react-compiler` (dev) and `babel-plugin-react-compiler` (dev, transitively required by Next's compiler integration).
- ESLint config — enable `react-compiler/react-compiler` at `error`.
- `src/lib/auth/actor.ts` — add `getActor(): Promise<{ id: string }>` that reads NextAuth session server-side and falls back to the dev user when `process.env.NODE_ENV !== 'production'`. Existing helpers untouched.
- Various client components where the compiler makes `useCallback`/`useMemo` redundant. Strip only where the lint rule confirms the wrapper was purely defensive. Candidates: `ApprovalFlowDiagram`, `AgentActivityPanel`, `WorkflowBuilder`, the approvals and chat pages.

**Not touched:** anything architectural. The job of this PR is to flip the compiler on and validate tests stay green.

**Escape hatch:** if the compiler surfaces an unresolvable issue in a single component, annotate it with `"use no memo"` plus a comment naming the specific reason. Document any such uses so they can be revisited.

### 3.2 PR 2 — Approvals queue

**Created:**
- `src/app/approvals/actions.ts` — `'use server'` file exporting `lockAction`, `releaseAction`, `approveAction`, `rejectAction`. Each uses `wrapAction` and returns `ActionResult<T>`.
- `src/lib/actions/result.ts` — shared `ActionResult<T>` type plus the `wrapAction()` helper.
- `src/app/approvals/_components/QueueClient.tsx` — client island that accepts `initialRequests` and `initialCounts` props, owns `useOptimistic` state, renders `QueueDashboard`, wires action buttons via `useActionState`.

**Added to existing files:**
- `src/services/approvalService.ts` — new method `listQueueForDashboard()`. Encapsulates what the current `GET /api/approvals/queue` route does: call `getQueueWithConfigs()`, run a Prisma `groupBy` for status counts, compute `priorityScore` per request, sort descending, return `{ requests, total, counts, configs }`. Business logic moving from route into service matches the CLAUDE.md layering rule.
- `src/lib/approvals/schemas.ts` — add `lockSchema`, `releaseSchema`, `approveSchema` (all shaped as `{ requestId: z.string() }`), and extend `rejectApprovalSchema` consumers' usage (the action validates `{ requestId, reason }`). These formalize the input contract that currently lives implicitly in the route handlers.

**Converted to Server Component:**
- `src/app/approvals/page.tsx` — `async function`, calls `approvalService.listQueueForDashboard()` directly, renders `<QueueClient initialRequests={...} initialCounts={...} />`.

**Refactored:**
- `src/components/approval/QueueDashboard.tsx` — stays `'use client'`. Accepts bound action functions instead of callback props. Buttons become `<form action={boundAction}>` so `useFormStatus` works inside.

**Deleted:**
- `src/app/api/approvals/queue/route.ts`
- `src/app/api/approvals/[id]/lock/route.ts`
- `src/app/api/approvals/[id]/release/route.ts`
- `src/app/api/approvals/[id]/approve/route.ts`
- `src/app/api/approvals/[id]/reject/route.ts`
- corresponding route-handler tests

The SSE route (`/api/sse/approvals`) stays — EventSource still needs an HTTP endpoint.

### 3.3 PR 3 — Approvals detail

**Created:**
- `src/app/approvals/[id]/_components/DetailClient.tsx` — client island for the interactive parts (flow diagram + reject modal).

**Added to existing files:**
- `src/services/approvalService.ts` — new method `getRequestWithScore(id)`. Encapsulates what the current `GET /api/approvals/[id]` route does: try the active-queue lookup first (for scoring continuity), fall back to `getRequest(id)` for resolved requests, return the record with a computed `priorityScore`. Removes the "active queue vs resolved" branching from the route layer.

**Converted to Server Component:**
- `src/app/approvals/[id]/page.tsx` — `async`, calls `approvalService.getRequestWithScore(id)`, renders `<DetailClient initialRequest={...} />`.

**Refactored:**
- `src/components/approval/RejectModal.tsx` — `<form action={rejectAction}>`. `useActionState` for reason + pending. `useFormStatus` on the submit button. `requestFormReset` from `react-dom` if we need post-success reset behavior.

**Deleted:**
- `src/app/api/approvals/[id]/route.ts` (GET)
- its route-handler test

### 3.4 PR 4 — Chat input

**Refactored:**
- `src/components/chat/ChatInput.tsx` — `<form action>` wrapping the existing `onSend` callback; `useActionState` for message state; `useFormStatus` on submit.
- `src/app/chat/page.tsx` — minor cleanup: no longer passes `disabled` through to `ChatInput` (handled internally via `useFormStatus`).

**Not refactored:**
- `ChatHistory` — its `refreshTrigger` pattern is tied to streaming state. Leave alone.
- Streaming chat routes — SSE endpoints, not forms.

### 3.5 Cross-cutting

**Untouched:**
- `src/lib/sse/useApprovalEvents.ts` — callback-ref pattern is correct for what it does.
- `src/lib/approvals/repository.ts` — no schema or contract changes.
- `src/lib/approvals/sseServer.ts` — unchanged; actions are an additional caller.
- `src/lib/errors/AppError.ts` + `handler.ts` — unchanged; Server Actions catch and translate to `ActionResult`, same way route handlers translate to HTTP responses.

**Extended (additive only, no behavior change to existing methods):**
- `src/services/approvalService.ts` — gains `listQueueForDashboard()` (PR 2) and `getRequestWithScore(id)` (PR 3). These pull business logic that currently leaks into route handlers back into the service layer, aligning with CLAUDE.md. Existing methods and their semantics are unchanged.
- `src/lib/approvals/schemas.ts` — gains `lockSchema`, `releaseSchema`, `approveSchema` (PR 2).

## 4. Data Flow

### 4.1 Initial page load

```
Browser → /approvals
  RSC src/app/approvals/page.tsx
    await getActor()
    const { requests, counts, configs } =
      await approvalService.listQueueForDashboard()
  RSC returns HTML + serialized props → <QueueClient>
Browser hydrates <QueueClient initialRequests=... initialCounts=... />
```

No API route. No loading spinner on first paint. Data is in the HTML.

### 4.2 Mutation — lock

```
Browser: form submit → lockAction('abc', formData)
  Client before dispatch: useOptimistic applies row.status='REVIEWING', assignee=self
  Client: useActionState.isPending=true
  Client: useFormStatus.pending=true inside the form

Server Action lockAction(requestId, _formData):
  actor = await getActor()
  { requestId: id } = lockSchema.parse({ requestId })
  updated = await approvalService.lock(id, actor.id)
  broadcastApprovalEvent({ event: 'approval.locked', data: updated })
  return { ok: true, data: updated }

Client receives result:
  ok:true → optimistic state is replaced by authoritative data
  ok:false → optimistic state rolls back (React handles this automatically)

Other clients:
  SSE 'approval.locked' → useApprovalEvents → onRefresh → re-sync
```

### 4.3 SSE echo on the mutating client

The mutating client also receives its own broadcast. Two options were considered:

- **A.** Tag broadcasts with a `clientId` and filter self-echoes on the client.
- **B.** Let the echo land; it carries the same data the action already committed; no flash.

Chosen: **B.** Only go to A if real-world testing shows flicker. The broadcast payload matches the action return value, so the reconcile is a no-op at the render layer.

### 4.4 Why no `revalidatePath` on the mutating client

Stated in 2.4; summarized here in flow terms: the action return value updates this client, SSE updates other clients, `useOptimistic` gives instant feedback. Adding `revalidatePath` means re-serializing the entire queue RSC on every click for no visible gain and guaranteed flicker.

### 4.5 Optimistic state shape

```typescript
const [optimisticRequests, applyOptimistic] = useOptimistic(
  initialRequests,
  (current, action: OptimisticAction) => { /* patch the matching row */ }
)
```

`OptimisticAction` is a discriminated union (`{ type: 'lock', id, reviewer }` etc.). Patches touch only the fields affected. React replaces optimistic state with the authoritative list on the next commit.

## 5. Error Handling

### 5.1 Raising (service layer, unchanged)

`approvalService` throws typed `AppError` instances. No service changes. Same errors that travel through `handleApiError` today will travel through `wrapAction` tomorrow.

### 5.2 Translating (`wrapAction`)

Single entry point every action uses. Responsibilities:

1. Resolve the actor via `getActor()`. Unauthorized → `{ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }` without invoking the callback.
2. Start an OTEL span (`action.{name}`; attributes `actor.id`, `action.name`). Mirrors `withApi` for parity.
3. Run the callback, which receives the resolved actor.
4. Catch in priority order:
   - `ZodError` → `{ code: 'VALIDATION', message: 'Invalid input', fields: { ... } }` with flattened field paths.
   - `AppError` → `{ code: e.code, message: e.message }`. The HTTP status inside the error is ignored here — actions don't speak HTTP.
   - Anything else → log full stack + actor id + span id at `error` level; return `{ code: 'INTERNAL', message: 'Something went wrong' }`. Never leak internal error text to the client.
5. Mark the span errored in every catch branch before returning.

### 5.3 Per-action shape

```typescript
'use server'
export async function lockAction(requestId: string, _formData: FormData) {
  return wrapAction(async (actor) => {
    const { requestId: id } = lockSchema.parse({ requestId })
    const updated = await approvalService.lock(id, actor.id)
    broadcastApprovalEvent({ event: 'approval.locked', data: updated })
    return updated
  })
}
```

No try/catch inside. `formData` is accepted for the form-action contract, ignored when the data all comes from bound args.

### 5.4 Surfacing (client)

Client islands never try/catch around action calls. `useActionState`'s state is the `ActionResult`. Branching on `result.ok` drives UX. A single helper `src/lib/actions/errorMessage.ts` maps known codes to human copy; unknown codes fall through to `error.message` (already sanitized). Validation errors use `error.fields` inline; all others surface via toast.

### 5.5 Production concerns

- **Idempotency.** Lock/release are non-idempotent at the domain level. The service already throws `AppError.lockedByOther` / `AppError.notLocked`; actions pass through.
- **Concurrent submissions.** `useActionState` queues submissions. Double-click on Lock = two sequential actions; the second returns `LOCKED_BY_OTHER`. No client-side debouncing needed.
- **SSE broadcast failures.** If `broadcastApprovalEvent()` throws, we catch and log inside the action. The mutation itself succeeded; one missed event is recovered on the next broadcast or reconnect. Matches current API route behavior.
- **Auth failures mid-action.** Session expiry between render and click → `getActor()` throws → `wrapAction` returns `UNAUTHORIZED` → client shows "Session expired" toast. In the dev-fallback phase this path is unreachable.

## 6. Testing

### 6.1 What each layer tests

- **Unit — service.** Unchanged. Mock repository via `IApprovalRepository`. This remains where domain logic coverage lives.
- **Unit — client islands.** `QueueClient`, `DetailClient`, updated `RejectModal`. Mock the Server Action functions directly at the import boundary. Assertions: optimistic state applied, rollback on failure, error toast copy, form reset on success, `useFormStatus` wiring.
- **Unit — `wrapAction`.** New `__tests__/unit/lib/actions/result.test.ts`. Covers actor resolution, unauthorized short-circuit, Zod → VALIDATION with `fields`, AppError → code+message, unexpected → sanitized INTERNAL, span lifecycle.
- **Integration — actions.** New `__tests__/integration/actions/approvals.test.ts`. Imports action functions directly, stubs `getActor()` via `vi.mock('@/lib/auth/actor')`, runs against the live test DB on port 5433. Covers lock/release/approve/reject happy paths and domain error paths; spies on `broadcastApprovalEvent`. Replaces the deleted route-handler integration tests.
- **E2E — Playwright.** Existing tests continue to work because they drive the UI, not HTTP. Audit for any `page.waitForResponse('/api/approvals/...')` calls and rewrite to DOM state waits.

### 6.2 Test seams

- **`getActor()` stubbing.** `vi.mock('@/lib/auth/actor')` in integration tests. In client-island unit tests, mock the action imports themselves.
- **`broadcastApprovalEvent` spying.** `vi.spyOn` on the module export. Existing tests that exercise the real writer set for the SSE route stay.
- **Server Action module boundary.** Invoked across a serialization boundary in production; a plain async function in the test runner. Integration tests can call directly, but actions must accept serializable args and return serializable results. `ActionResult<T>` already satisfies this; a comment inline in `src/lib/actions/result.ts` documents the constraint.

### 6.3 New test helpers

- `__tests__/helpers/mockActor.ts` — `withActor(id, fn)` wrapper around `vi.mock('@/lib/auth/actor')`.
- `__tests__/helpers/broadcastSpy.ts` — typed `vi.spyOn` helper with assertion sugar for event + data.

No new vitest config. The existing unit/integration split works.

### 6.4 What we explicitly don't test

- React Compiler output. Trust the compiler; testing memoization correctness means testing React itself.
- RSCs in isolation. Service tests cover the logic; client-island tests cover the render. An RSC-only tier adds noise without finding bugs.
- SSE timing/ordering beyond "the event was broadcast." The SSE route has existing tests; don't duplicate.

### 6.5 Per-PR checklist

- **PR 1:** all existing tests pass with compiler on; `wrapAction` unit tests added; `getActor` unit tests added.
- **PR 2:** route-handler tests deleted; action integration tests added (net-even file count); `QueueClient` unit tests added; E2E green.
- **PR 3:** detail-route-handler tests deleted; `rejectAction` integration tests added; `RejectModal` unit tests updated for the new form-action shape.
- **PR 4:** `ChatInput` unit tests updated for the new form-action shape. No action integration test — the action is a trivial wrapper around existing client-side streaming logic.

### 6.6 Coverage gate

80% threshold stays enforced. Each PR gate: (a) all tests pass, (b) coverage threshold still met, (c) typecheck clean. React Compiler lint rule at `error` gates PR 1.

## 7. Out of Scope

Listed here explicitly so the boundary is unambiguous:

- NextAuth sign-in UI, provider config, session DB schema verification, middleware.
- Streaming chat refactor (the `/api/chat` and `/api/chat/agent` routes are not forms).
- LangGraph `MemorySaver` → Postgres checkpoint migration.
- Schema or service-layer changes in the approvals domain.
- Migrating `ChatHistory` to an RSC.
- Workflow builder / reactflow modernization — covered by a prior commit.

## 8. Rollback

Each PR is independently revertable via a single `git revert`. The API routes and tests removed in PR 2 and PR 3 are recoverable from git history if a reversal is needed; the service layer they called is unchanged, so a revert restores full behavior without data-migration concerns. React Compiler can be disabled by flipping `reactCompiler: false` in `next.config.ts` without any code change elsewhere.
