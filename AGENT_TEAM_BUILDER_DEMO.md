# AI Agent Team Builder — Demo Walkthrough

A POC for visually designing multi-agent workflows, refining nodes through
structured forms, and running the team against a test input.

## Prerequisites

1. Infra + DB running:
   ```bash
   npm run infra:up
   npm run db:migrate
   npm run db:seed
   ```
2. `.env` configured with at minimum:
   - `AUTH_SESSION_SECRET` (32-byte base64)
   - `AZURE_AD_*` (see `docs/entra-id-local-setup.md`) **or** use the E2E
     bypass cookie (see `__tests__/helpers/mockSession.ts`)
   - `OPENAI_API_KEY` — required to actually execute an agent team or use the
     AI Designer
   - `TAVILY_API_KEY` — optional; enables the `tavily_search` tool
3. Dev server:
   ```bash
   npm run dev
   ```

Open <http://localhost:3000>. The home page's **"AI Agent Teams"** card links
to `/agent-teams`.

## Guided walkthrough (what to click)

### 1. Create a team

- Go to `/agent-teams`.
- Click **New Team**. You land on `/agent-teams/<id>` with a fresh canvas:
  a green Trigger node connected to a blue Output node.
- The title input at the top is editable. Change it to `Research Assistant`.
- Click **Save**. A timestamp replaces the "Unsaved changes" indicator.

### 2. Add an Agent node from the palette

- Left rail → click **Agent**. A new indigo node appears on the canvas and
  is auto-selected; the Properties tab on the right opens its form.
- Edit:
  - **Label**: `Researcher`
  - **Role**: `Research Analyst`
  - **System prompt**: `You gather up-to-date information and summarize it.`
  - **Tools**: check `tavily_search` and `calculator`.
- Drag connections: Trigger → Researcher → Output.
- **Save**.

> The header shows a red/amber badge if the graph is invalid (missing
> trigger/output, cycles, dangling edges, unknown tools). Hover for details.

### 3. Add a Guardrail

- Palette → **Guardrail**. Configure:
  - Type: `Blocklist`
  - Blocked terms: `password, ssn, credit card`
- Wire Trigger → Guardrail → Researcher. Save.

### 4. Use the AI Designer (chat-to-graph)

- Right rail → **AI Designer** tab.
- Prompt: `Add a Critic agent that reviews the researcher's output for factual accuracy before the final answer.`
- The designer returns a natural-language reply plus a structured `GraphDiff`
  (add_node / add_edge / remove_edge / patch_node / set_metadata). Click
  **Apply** to mutate the canvas. The existing Researcher→Output edge will be
  redirected through the new Critic node.
- Save.

> Under the hood this calls `POST /api/agent-teams/design` which wraps
> `ChatOpenAI.withStructuredOutput(diffSchema)` — the model is forced to emit
> valid, schema-typed ops instead of free-form JSON.

### 5. Run the team

- Right rail → **Run** tab.
- Input: `Summarize the latest news on agentic AI frameworks.`
- Click **Run**. You'll see streamed SSE events in the log:
  - `run_started`
  - `node_started` (Trigger)
  - `node_started` (Researcher), `tool_call` (tavily_search), `token` spans
  - `node_started` (Critic), tokens
  - `node_completed` per node
  - `final` with the rendered Markdown
- If a guardrail trips, you'll see a `guardrail_tripped` event and the run
  halts.
- **Cancel** aborts the stream via `AbortController`.

## Feature test checklist

Use this as a manual QA pass.

### Builder canvas
- [ ] New team lands on builder with a trigger→output starter graph.
- [ ] Palette buttons add typed nodes with sensible defaults.
- [ ] Clicking a node selects it and opens Properties.
- [ ] Dragging between handles creates an animated edge.
- [ ] Deleting a node cascades incident edges.
- [ ] Header badge reflects validator issues (try removing the output node).

### Property forms
- [ ] Agent form exposes: label, role, system prompt, model, temperature,
      max turns, tool toggles (with `placeholder` badges on mock tools).
- [ ] Guardrail form switches inputs when the type changes.
- [ ] Editing a field flips the "Unsaved changes" indicator.

### Persistence
- [ ] Save writes and "Saved <time>" replaces the dirty badge.
- [ ] Reload restores title, nodes, edges, and property values.
- [ ] `/agent-teams` list shows the team with last-updated timestamp.
- [ ] Delete from the list removes it and re-renders empty state if last.

### AI Designer
- [ ] Prompt + Send calls `/api/agent-teams/design` and shows a reply +
      diff preview.
- [ ] Apply mutates the canvas and flips the dirty flag.
- [ ] Invalid diffs (e.g. change a node's kind) are rejected by
      `applyDiff` without corrupting the graph.

### Execution
- [ ] `Run` streams SSE events and renders a final output card.
- [ ] Guardrail trip halts the run and surfaces a `guardrail_tripped` event.
- [ ] Agent tool usage emits `tool_call` events.
- [ ] Cancel mid-run stops the stream client-side.

### Auth / ownership
- [ ] Unauthenticated visit to `/agent-teams` redirects through
      `/auth/signin` to Entra.
- [ ] Teams are scoped to the signed-in user (another user's team returns
      NOT_FOUND → 404 via `notFound()` in the builder route).

### Tests
- [ ] `npm run test:unit -- agentTeams` all green (graph validator, diff
      applier, service, schemas, route handler).
- [ ] `npx playwright test agent-teams` runs the happy-path spec.

## Request / response contracts

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/agent-teams` | GET | List current user's teams |
| `/api/agent-teams` | POST | Create (name required, definition optional) |
| `/api/agent-teams/[id]` | GET | Fetch detail (owner-gated) |
| `/api/agent-teams/[id]` | PUT | Update name/description/definition |
| `/api/agent-teams/[id]` | DELETE | Delete (owner-gated) |
| `/api/agent-teams/design` | POST | Chat designer, returns diff + reply |
| `/api/agent-teams/[id]/run` | POST | Executes team, SSE stream of events |

All routes run through the auth middleware; services throw typed `AppError`
instances and the routes translate them via `handleApiError`.

## Where to look in the code

- `src/lib/agentTeams/` — domain types, registry, validator, diff, executor,
  designer, tools, guardrails
- `src/services/agentTeamService.ts` — owner-gated CRUD, validation gates
- `src/app/api/agent-teams/` — route handlers
- `src/components/agentTeams/` — ReactFlow builder, palette, property panel,
  chat designer, run panel
- `src/app/agent-teams/` — list + detail pages
- `__tests__/unit/lib/agentTeams/` and `__tests__/unit/services/agentTeamService.test.ts`
- `__tests__/e2e/agent-teams.spec.ts`

See `AGENT_TEAM_BUILDER_POC_DECISIONS.md` for the list of things that are
mocked/faked and need a production decision.
