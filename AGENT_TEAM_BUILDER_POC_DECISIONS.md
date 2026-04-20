# Agent Team Builder — Placeholders & Open Decisions

Things this POC fakes or stubs. Each item notes **what it is today**, **why
that's fine for a demo**, and **what a production decision needs to cover**.

---

## 1. `http_get` tool is a canned mock

- **Where**: `src/lib/agentTeams/tools.ts` — `httpGetMockTool()`
- **Today**: Returns a fixed string "`<!-- MOCK HTTP RESPONSE for <url> -->`"
  no matter what URL the agent passes.
- **Why fake**: Real HTTP egress from a tool-calling agent is a high-risk
  surface — SSRF, data exfiltration, cost abuse, unbounded response sizes.
- **Prod decision needed**:
  - Allowlist of hosts/schemes, or a proxy service
  - Timeout + max body size caps
  - Content-type allowlist (reject HTML/script payloads)
  - Per-team / per-user egress budget
  - Audit logging of every call

## 2. `kb_lookup` tool is a canned dictionary

- **Where**: `src/lib/agentTeams/tools.ts` — `kbLookupMockTool()`
- **Today**: Three hard-coded keys (`refund`, `sla`, `onboarding`).
- **Why fake**: Real RAG needs a vector store, an embedding model, and a
  document ingest pipeline — out of scope for a frontend-heavy POC.
- **Prod decision needed**: which vector DB (pgvector vs Pinecone vs Azure
  AI Search); embedding model; ingest pipeline; per-team corpus scoping.

## 3. Relevance guardrail is a keyword heuristic

- **Where**: `src/lib/agentTeams/guardrails.ts` — `evaluateGuardrail()` with
  `kind: 'relevance'`
- **Today**: Case-insensitive substring match against a single topic keyword.
- **Prod decision needed**: swap to an LLM classifier or a small embedding
  similarity check. If using an LLM, what's the token budget vs. the main
  run? What's the failure-mode if the guardrail itself errors?

## 4. No retries / streaming persistence on executor

- **Where**: `src/lib/agentTeams/executor.ts`
- **Today**: Linear topological walk; failure of any node fails the run.
  Events are streamed to the client but not persisted.
- **Prod decision needed**:
  - Per-node retry policy (idempotent? exponential backoff? max attempts?)
  - Persist `WorkflowExecution` + per-node events so users can replay or
    view history.
  - Partial-failure semantics: allow downstream nodes to proceed if one
    agent errors out?

## 5. Parallel agents not supported

- **Where**: `src/lib/agentTeams/executor.ts` runs nodes sequentially.
- **Today**: Even if two branches diverge in the graph, the executor walks
  them one at a time.
- **Prod decision needed**: Promise.all over independent topological layers
  vs. a real workflow engine (Temporal, Inngest, LangGraph subgraphs). This
  touches billing (concurrent OpenAI calls) and observability.

## 6. Ownership model is single-user

- **Where**: `src/services/agentTeamService.ts` — owner checks compare
  `createdById` with the actor.
- **Today**: Only the creator can read/update/delete.
- **Prod decision needed**:
  - Shared teams within an org? Role-based ACL (Admin / Editor / Runner)?
  - Entra group sync for team access?
  - Default visibility: private vs org-visible vs public-read?

## 7. No team versioning

- **Where**: `TeamDefinition.version` is hard-coded to `1`; saves overwrite.
- **Today**: Editing is destructive — no "restore previous" button.
- **Prod decision needed**: version-table vs. delta log vs. git-style. This
  also affects the AI Designer — a redo/undo UX is much nicer if we have
  snapshots.

## 8. AI Designer has no conversation memory

- **Where**: `src/lib/agentTeams/designer.ts` — `runDesigner()`
- **Today**: The client passes `history`, but nothing persists server-side.
  Closing the builder loses the dialog.
- **Prod decision needed**: persist designer chats as first-class objects;
  decide whether they attach to the team or live on a user's scratchpad.

## 9. Hosted model list is hard-coded

- **Where**: `PropertyPanel.tsx` AgentForm select — `gpt-4o-mini`, `gpt-4o`,
  `gpt-4.1-mini`.
- **Today**: Menu, not a catalog.
- **Prod decision needed**: read from a model registry (cost + capability +
  availability by org); possibly hide models behind entitlements.

## 10. No per-team cost/latency observability

- **Where**: nowhere.
- **Today**: Runs emit telemetry via the shared instrumentation but there's
  no UI for "how much did my team cost this week".
- **Prod decision needed**: aggregate token + tool-call metrics; attach to
  the team detail page.

## 11. Guardrail failures are the only hard stop

- **Today**: If an agent returns empty or refuses, the run continues and
  downstream nodes receive an empty string.
- **Prod decision needed**: a "halt on empty" flag per agent; automatic
  fallback agents; configurable minimum-confidence thresholds.

## 12. In-memory checkpointer for the LangGraph agent

- **Where**: `src/lib/agent/agent.ts` uses `MemorySaver` from
  `@langchain/langgraph` (inherited from the existing chat agent).
- **Today**: State resets on server restart.
- **Prod decision needed**: swap in `@langchain/langgraph-checkpoint-postgres`
  once long-lived runs or multi-step human approvals are needed. (Already
  flagged in root `CLAUDE.md`.)

## 13. The "Approver" role seed is reused for auth gating

- **Where**: E2E tests use `roles: ['Approver']` because that's what the
  seed script provisions. Agent-team routes only check ownership, not role.
- **Prod decision needed**: a dedicated `TeamAuthor` / `TeamRunner` role,
  or rely purely on ownership. Today anyone signed in can create a team.

## 14. Reused `Workflow` Prisma tables

- **Where**: repository writes to `prisma.workflow` / related models.
- **Why**: Shipping a POC without a schema migration.
- **Prod decision needed**: Either rename these to `AgentTeam*` or formalize
  that `Workflow` is the generic graph table. If kept, add an
  `engine: 'agent-team' | 'approval-pipeline'` discriminator so we can
  reason about the rows safely.

---

## Quick reference: what's real vs. fake

| Area | Real | Faked/placeholder |
| --- | --- | --- |
| Auth + ownership | ✅ | Role-based access (14) |
| CRUD + validation | ✅ | Versioning (7) |
| Visual builder | ✅ | — |
| `calculator` tool | ✅ (mathjs) | — |
| `tavily_search` tool | ✅ (if key set) | — |
| `http_get` tool | — | ✅ Mocked (1) |
| `kb_lookup` tool | — | ✅ Mocked (2) |
| Blocklist guardrail | ✅ | — |
| Length guardrail | ✅ | — |
| Relevance guardrail | — | ✅ Heuristic (3) |
| Execution streaming | ✅ (SSE) | Persistence (4) |
| Parallel execution | — | ✅ Sequential only (5) |
| AI Designer (diff ops) | ✅ | No memory (8) |
| Cost / latency UI | — | ✅ (10) |
