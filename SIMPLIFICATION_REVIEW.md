# Next.js 16 Simplification Review

Grounded in Next.js 16 App Router docs (route handlers, error boundaries, streaming, BFF patterns) pulled via context7 from `/vercel/next.js`. Findings ordered by impact; all reference `file:line`.

## High impact

### 1. Fake `WritableStreamDefaultWriter` shim
**File:** `src/app/api/sse/approvals/route.ts:12-26`

The route fabricates a writer object (with stubbed `releaseLock`, `closed`, `abort`, etc.) so `sseServer.ts` can call `.write()`. The Next.js idiom is a plain `ReadableStream` + `controller.enqueue`. Have `addClient` store a `{ controller, encoder }` pair and have `broadcastApprovalEvent` call `controller.enqueue(encoder.encode(msg))` directly. Deletes ~15 lines of shim and one layer of abstraction.

### 2. Dead repository methods
**File:** `src/lib/approvals/repository.ts:63-91`

`ApprovalRepository.approve` / `.reject` are declared on `IApprovalRepository`, but the service bypasses them and calls `prisma.$transaction` inline (`src/services/approvalService.ts:97-152`). Pick one layer. Either move the transactional logic into the repo and call it from the service, or delete the repo methods. Current state has divergent logic living in two places.

### 3. `lock` splits the critical section across tx + non-tx write
**File:** `src/services/approvalService.ts:61-88`

The `$transaction` checks status/lock state, then the final write happens via `this.repo.lock(...)` *outside* the transaction. Two racing lock calls can both pass the check and only one wins cleanly. Put the validation *and* the update in the same `$transaction`.

### 4. Prisma error codes leak into the route
**File:** `src/app/api/approvals/route.ts:30-38`

`P2003` / `P2025` translation belongs in the service (or repo), not the route. The route should only validate input and call the service. Matches the BFF pattern in Next.js docs and makes the layer boundary cleaner.

### 5. `createSpan(...).catch(handleApiError)` wrapper in every route
**Files:** all approval routes + chat routes

Clever but non-idiomatic vs. Next.js's plain `try/catch` pattern. A single helper `withApi(spanName, async (req, ctx) => ...)` would unify tracing + `handleApiError` and eliminate the `NextRequest, NextResponse` imports repeated across 8 handlers. Alternatively inline `try/catch` — fewer concepts.

## Medium impact

### 6. Unused `approvalApi` client
**File:** `src/lib/api/approvals.ts`

The approvals page uses raw `fetch` (`src/app/approvals/page.tsx:42-48`) instead of the client wrapper. Adopt it or delete it.

### 7. Unused body fields from the UI
**File:** `src/app/approvals/page.tsx:55-82`

Client sends `reviewerId` / `approverId` / `rejectorId`; server calls `getActorId()` and ignores them. Remove the fields — prevents a future dev from trusting client-supplied actor IDs.

### 8. Duplicated SSE framing in chat routes
**Files:** `src/app/api/chat/route.ts:47-75`, `src/app/api/chat/agent/route.ts:59-127`

Both manually format `data: ...\n\n`, manage `TextEncoder`, and emit `[DONE]`. Extract `sseEncode(obj)` + a small `createSSEStream(producer)` helper — handlers shrink ~50%. The `ai` SDK (already a dep) also covers this if you want to go further.

### 9. `ThemeProvider` FOUC
**File:** `src/providers/ThemeProvider.tsx:16-28`

Default `'light'` then effect flips to dark → visible flash on dark-mode users. Use an inline head script (or cookie-driven class on `<html>` in the server layout). Or adopt `next-themes` and delete ~40 lines.

### 10. Hand-rolled `CompiledAgent` interface
**File:** `src/lib/agent/agent.ts:10-28`

Shadows LangGraph's own types and will drift. Use `ReturnType<typeof createReactAgent>` or just let inference flow. Less type to maintain.

### 11. Error handler leaks internal messages
**File:** `src/lib/errors/handler.ts:11-13`

Falls back to `error.message` for 500s. Next.js docs recommend a generic message on unknown errors; keep the detailed log server-side only.

## Low impact / nits

### 12. `rejectBodySchema` re-defined
**File:** `src/app/api/approvals/[id]/reject/route.ts:10-12` vs `src/lib/approvals/schemas.ts:10-12`

Import the shared `rejectApprovalSchema`.

### 13. `SSE_HEADERS` disagrees with SSE route
**Files:** `src/lib/sse/eventTypes.ts:1-5`, `src/app/api/sse/approvals/route.ts:57-60`

Constant says `'no-cache'`; the route uses `'no-cache, no-transform'`. Unify; have the route import the constant.

### 14. Dead `message`-event branch
**File:** `src/lib/sse/useApprovalEvents.ts:49-58`

Parses `event.data` looking for `parsed.event`, but the server emits named events (`event: request:locked\n...`), which never fire the default `message` listener. Remove.

### 15. `calculatePriorityScore` throws on clock skew
**File:** `src/lib/approvals/priorityScore.ts:9-11`

Clamp age to 0 instead of throwing — a couple seconds of DB/app clock drift shouldn't crash the queue.

### 16. Redundant `loading.tsx`
**File:** `src/app/approvals/page.tsx:85-91`

The page renders its own loader inside a client page; the sibling `loading.tsx` only covers RSC load, which is near-instant since the page does the fetch client-side. Either convert the page shell to RSC + `<Suspense>` around a client island, or drop `loading.tsx`.

### 17. `getActorId` stub should fail loudly in prod
**File:** `src/lib/auth/actor.ts`

Throw if `NODE_ENV === 'production'` so the hardcoded actor can't ship.

## Suggested order of attack

If you do one change: **#3 (lock race)** — correctness first. Then **#2 + #1** (delete dead code / remove shim) — biggest simplification wins. Then the route-handler wrapper (**#5**), which touches many files but collapses boilerplate uniformly.

A sensible first PR: bundle **#1 + #2 + #3** together, since they all touch the approvals/SSE core.
