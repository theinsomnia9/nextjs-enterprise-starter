# OpenTelemetry logs + metrics expansion

**Status:** Design approved, awaiting implementation plan
**Branch:** `feat/otel-logs-metrics`
**Date:** 2026-04-21

## Problem

The repo has a working OpenTelemetry **tracing** setup — `NodeSDK` with auto-instrumentations, a manual `createSpan` helper, OTLP HTTP export to a local collector, Jaeger as the trace backend. It does not have:

- A `LoggerProvider` or any way for application code to emit structured logs to the collector. Logs today are `console.*` calls scattered across ~10 sites.
- A `MeterProvider`-backed API for application code to emit counters or histograms. The SDK is wired for metric export, but zero application metrics are defined anywhere in `src/`.
- A log backend. The collector's pipelines today only route traces (to Jaeger) and metrics (to Prometheus). There is no logs pipeline and no Loki or equivalent.
- Any instrumentation example that would teach a future contributor the "right" way to emit telemetry from a new feature.

The goal is a production-grade **local** observability blueprint: the app emits traces, metrics, and structured logs for every instrumented operation; all three are correlated; Grafana can show all three in one place; and the pattern is easy to copy into any new feature. The Team Builder feature gets three concrete instrumentation examples that together exercise all three pillars and cover the architecture's three layers (service method, API route / long-running operation, LLM call).

## Non-goals

- **No client-side (browser) OTel.** Instrumenting `AgentTeamBuilder.tsx` user interactions requires a different SDK (`sdk-trace-web`) and different transport considerations (CORS, beacon API, sampling). Out of scope for this pass.
- **No mass `console.*` migration.** Existing `console.*` calls outside the three team-builder sites stay untouched. A separate follow-up PR can sweep them.
- **No Edge-runtime logging.** `instrumentation.edge.ts` stays tracing-only. Middleware continues using `console.*`.
- **No Tempo, no ClickHouse, no multi-tenant Loki.** Single-node Loki on a named volume; Jaeger stays as the trace backend.
- **No feature flag.** Telemetry is additive; if the collector is down, exports fail silently (already current behavior).
- **No pre-built Grafana dashboards beyond one.** One minimal dashboard demonstrating end-to-end pipes. Rich dashboards are their own project.

## Architecture

### File layout

```
src/lib/telemetry/
  instrumentation.node.ts    # existing — gains LoggerProvider wiring
  instrumentation.edge.ts    # existing — untouched
  tracing.ts                 # existing — docstring pointer added
  resource.ts                # NEW — single source of truth for service identity
  metrics.ts                 # NEW — getMeter + createCounter + createHistogram
  logger.ts                  # NEW — logger + childLogger
  index.ts                   # NEW — barrel re-export
```

Three invariants:

1. **One `Resource` object.** The trace, metric, and logger providers all receive the exact same `Resource` from `resource.ts`. Without this, logs and traces won't correlate in Grafana because Loki and Jaeger tag them with different `service.name` values.
2. **Module-level singletons.** `getMeter`, `createCounter`, `createHistogram` cache by name. Logger is a single exported instance.
3. **Trace correlation is automatic, not caller-supplied.** The logger reads `trace.getActiveSpan()` at call time and attaches `trace_id`/`span_id` to every log record. Callers never pass these.

### Public helper surface

#### `resource.ts`

```ts
export function buildResource(): Resource
```

Reads `OTEL_SERVICE_NAME` (fallback `'nextjs-boiler-plate'`), `npm_package_version`, `NODE_ENV`. Returns a `Resource` with `service.name`, `service.version`, `deployment.environment`.

#### `metrics.ts`

```ts
export function getMeter(name: string): Meter
export function createCounter(
  name: string,
  opts?: { description?: string; unit?: string },
): Counter
export function createHistogram(
  name: string,
  opts?: {
    description?: string
    unit?: string
    advice?: { explicitBucketBoundaries?: number[] }
  },
): Histogram
```

Counters and histograms cache by name. The file-level doc comment states the naming convention and the low-cardinality rule:

- Counters: `<domain>.<noun>.total` → `agent_team.save.total`
- Histograms: `<domain>.<verb>.duration`, unit `ms` → `agent_team.save.duration`
- Attribute keys: snake_case, low-cardinality. **Never** put `user.id`, `team.id`, `trace_id`, or any unbounded-cardinality value on a metric attribute. Those belong on spans and log records.

#### `logger.ts`

```ts
type LogAttrs = Record<string, string | number | boolean | null | undefined>

export const logger: {
  debug(msg: string, attrs?: LogAttrs): void
  info(msg: string, attrs?: LogAttrs): void
  warn(msg: string, attrs?: LogAttrs): void
  error(msg: string, attrs?: LogAttrs): void
  error(msg: string, err: Error, attrs?: LogAttrs): void
}

export function childLogger(baseAttrs: LogAttrs): typeof logger
```

Behavior:

- **Dual output.** Each call emits a `LogRecord` via the global `LoggerProvider` (→ collector → Loki) *and* a stdout line (pretty in dev, single-line JSON in prod).
- **Trace correlation.** `trace_id` / `span_id` are read from `trace.getActiveSpan()` at call time and attached automatically.
- **`error()` overload.** `logger.error('x failed', err)` and `logger.error('x failed', err, { teamId })` both work. The `Error`'s `name`, `message`, and `stack` become structured attributes.
- **`childLogger`** binds a base attribute map for a scope (e.g., a request handler binds `{ route: '...' }`). Returns the same interface.
- **Level filtering** from `LOG_LEVEL` env, default `info`. Filters stdout output. OTel export is always full-fidelity; collector-side filtering is the right place for ingest-side reduction.

#### `index.ts`

Barrel: re-exports from `tracing.ts`, `metrics.ts`, `logger.ts`. Callers import from `@/lib/telemetry` only.

### `instrumentation.node.ts` changes

Pseudocode of the diff shape:

```ts
const resource = buildResource()

// existing: NodeSDK for traces and metrics, now with resource passed explicitly
// new:
const loggerProvider = new LoggerProvider({ resource })
loggerProvider.addLogRecordProcessor(
  new BatchLogRecordProcessor(
    new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
  ),
)
logs.setGlobalLoggerProvider(loggerProvider)
```

Shutdown hook extended to also flush the `LoggerProvider`.

## Infra changes

### `infra/docker-compose.yml`

Add `loki` service:

```yaml
loki:
  image: grafana/loki:3.2.0
  container_name: nextjs-loki
  ports: ['3100:3100']
  command: -config.file=/etc/loki/local-config.yaml
  volumes:
    - ./loki/local-config.yaml:/etc/loki/local-config.yaml:ro
    - loki-data:/loki
  healthcheck:
    test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3100/ready']
    interval: 10s
    timeout: 5s
    retries: 5
```

Plus `loki-data:` added to the top-level `volumes:` block. `otel-collector` gains `loki` in its `depends_on:` with `condition: service_healthy`.

### `infra/loki/local-config.yaml`

New file. Stock single-binary Loki local config: filesystem-backed storage at `/loki`, no multi-tenancy, 7-day retention. Copied from the upstream reference config with minimal edits.

### `infra/otel-collector-config.yaml`

Add Loki exporter and logs pipeline:

```yaml
exporters:
  # …existing…
  otlphttp/loki:
    endpoint: http://loki:3100/otlp
    tls: { insecure: true }

service:
  pipelines:
    # …existing traces and metrics pipelines…
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [otlphttp/loki, debug]
```

Loki 3.x exposes a native OTLP ingest endpoint at `/otlp/v1/logs`, so the standard `otlphttp` exporter works without the contrib-image-only `loki` exporter. **Risk:** if the pinned image rejects the collector's payload, fall back to the `otel/opentelemetry-collector-contrib` image and use the `loki` exporter directly. The plan will include a validation step before committing.

### `infra/grafana/provisioning/datasources/datasources.yml`

Add Jaeger and Loki as datasources. The Loki entry defines a derived field that extracts `trace_id` from log lines and links it to the Jaeger datasource — this is what enables click-through from log to trace inside Grafana.

### `infra/grafana/dashboards/agent-teams.json`

New minimal dashboard, four panels:

1. `sum by (result) (rate(agent_team_save_total[5m]))` — stacked area, save rate by result.
2. `histogram_quantile(0.50|0.95|0.99, sum by (le) (rate(agent_team_save_duration_bucket[5m])))` — three lines, p50/p95/p99 save latency.
3. `sum by (event_type) (rate(agent_team_run_events_total[5m]))` — stacked area, run event rate.
4. Loki logs panel, query `{service_name="nextjs-boiler-plate"} |= "agent_team"`, TraceID derived field visible on rows.

### Environment

Add to `.env.example`:

- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` (documented; already read by SDK)
- `OTEL_SERVICE_NAME=nextjs-boiler-plate` (documented; read by `resource.ts`)
- `LOG_LEVEL=info` (new; read by `logger.ts` for stdout filtering)

## Team-builder instrumentation

Three examples. Each uses all three pillars.

### Example 1 — `agentTeamService.update()`

**File:** `src/services/agentTeamService.ts`.

- **Span:** `team.update` wrapping the method body via `createSpan`. Attrs: `team.id`, `user.id`, `changed_fields` (comma-separated list of top-level keys that differ between the incoming patch and the loaded team).
- **Counter:** `agent_team.save.total` incremented once per call with attr `{ result: 'ok' | 'validation_error' | 'forbidden' | 'not_found' | 'error' }`. Strict enum — no freeform strings.
- **Histogram:** `agent_team.save.duration` (ms), same `result` attr, recorded in `finally`.
- **Logs:**
  - Success: `logger.info('agent_team.save', { teamId, changedFields, result: 'ok' })`
  - Validation error: `logger.warn('agent_team.save', { teamId, issues, result: 'validation_error' })`
  - Unexpected error: `logger.error('agent_team.save failed', err, { teamId })`

### Example 2 — `POST /api/agent-teams/[id]/run` (SSE execution)

**Files:** `src/app/api/agent-teams/[id]/run/route.ts` and the executor's event loop.

- **Span:** `team.run` covering the whole run — opens at route entry, closes at stream end **or** `AbortSignal` fire. Attrs: `team.id`, `user.id`, `node_count`, `run.status` (`completed` | `failed` | `client_disconnect`), `run.duration_ms`.
- **Span events** for node boundaries: `node_started`, `node_completed`, `node_failed`, with `node.id` and `node.kind`. Makes the Jaeger timeline readable.
- **Counter:** `agent_team.run.total` with `{ result }`, one increment per run at stream close.
- **Counter:** `agent_team.run.events.total` with `{ event_type }`, one increment per event emitted.
- **Histogram:** `agent_team.run.duration` (ms). Explicit bucket boundaries up to ~5 minutes (e.g., `[10, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 30000, 60000, 150000, 300000]` ms) — default buckets max out too low for this workload.
- **Logs:**
  - `logger.info('agent_team.run.start', { teamId, userId, nodeCount })`
  - `logger.info('agent_team.run.end', { teamId, result, durationMs, eventCounts })`
  - `logger.error('agent_team.run failed', err, { teamId })`
  - Per-event stream entries are **not** logged at info level — volume/cardinality trap. Debug-level only, off by default.

**Gotchas:**

- Span must close on the request's `AbortSignal`, not only on normal return. Otherwise stale spans leak when clients disconnect mid-stream. Plan includes a regression test that aborts mid-stream and asserts the span ended.
- The run span ends once, even if both normal completion and disconnect fire.

### Example 3 — AI designer proposal

**File:** `src/lib/agentTeams/designer.ts` (the function invoked by `ChatDesigner`).

- **Span:** `team.designer.propose`. Attrs: `llm.provider` (`openai` | `azure-openai`), `llm.model` (from `chatModelName()`), `llm.temperature`, `prompt.token_count` + `response.token_count` if the SDK returns usage.
- **Histogram:** `llm.call.duration` (ms), attrs `{ provider, model, operation: 'team_designer.propose' }`. Named generically because chat and agent features will reuse the same metric when instrumented later.
- **Counter:** `llm.tokens.total` with `{ provider, model, operation, direction: 'prompt' | 'completion' }` **only if** the response exposes usage. Do not emit zeros when usage is missing — that pollutes rate queries.
- **Logs:** `logger.info('llm.call', { provider, model, operation, promptTokens, completionTokens, durationMs })`. **Never log prompt or response content** — PII/security line. Token counts and sizes only.

### Explicitly not instrumented

- `agentTeamService.list` / `get` / `create` / `delete` — mechanical copies of Example 1, not illustrative.
- Client-side node operations in `AgentTeamBuilder.tsx`.
- HTTP layer itself — `@opentelemetry/instrumentation-http` covers that automatically.
- Validation — failure is already surfaced via the `validation_error` label on `agent_team.save.total`.

## Testing

### Unit

- `__tests__/unit/lib/telemetry/resource.test.ts` — env-var precedence, fallbacks.
- `__tests__/unit/lib/telemetry/metrics.test.ts` — `createCounter`/`createHistogram` cache by name; duplicate names return same instrument.
- `__tests__/unit/lib/telemetry/logger.test.ts` — `trace_id`/`span_id` auto-attach under an active span; `error()` overload handles `Error` vs attrs; level filtering on stdout. Uses an in-memory `LoggerProvider`.
- `__tests__/unit/services/agentTeamService.test.ts` — extended (or created) with a mock repo; asserts `logger.info` is called with `{ result: 'ok', changedFields: [...] }` on success.

Assertions focus on logger calls, not on span or metric values (less brittle).

### Integration

- `__tests__/integration/telemetry/pipeline.test.ts` — new. Wires in-memory exporters (`InMemorySpanExporter`, `InMemoryMetricExporter`, `InMemoryLogRecordExporter`) via a test harness. Invokes `agentTeamService.update()` against the real test DB on port 5433. Asserts one span named `team.update`, one `agent_team.save.total` counter increment, one `agent_team.save.duration` observation, one `LogRecord` with a trace/span ID attached.

### E2E

None. Asserting on Loki or Jaeger from Playwright is brittle. The integration test above is the real end-to-end guarantee.

### Manual smoke test (documented in the PR description)

1. `npm run infra:up`
2. `npm run dev`
3. Exercise team save and team run in the UI
4. Open Grafana at `http://localhost:3001`, Explore → Loki, query `{service_name="nextjs-boiler-plate"}`
5. Click a `TraceID` derived-field link on a log row; verify Jaeger opens with the matching trace
6. Open the `agent-teams.json` dashboard; verify all four panels show data

## Rollout

- Single PR on `feat/otel-logs-metrics`.
- No feature flag. Telemetry is additive; missing collector = silent no-op, which matches today's tracing behavior.
- Existing `console.*` calls outside the three touched team-builder sites stay as-is. Mass migration is a separate PR.

## Risks

1. **Loki 3.x OTLP endpoint compatibility.** Native OTLP ingest in Loki is version-sensitive. If `grafana/loki:3.2.0` rejects the collector's payload, fall back to the contrib collector image + the `loki` exporter. Validate before committing.
2. **LoggerProvider registration order.** `instrumentation.node.ts` must register the global `LoggerProvider` before any app module imports `logger`. The Next.js instrumentation hook runs before app code so this is fine in practice, but any test that imports `logger` without the hook gets a no-op provider. Logger test file constructs its own provider for isolation.
3. **Cardinality discipline isn't enforced.** It's documented in `metrics.ts` and in `CLAUDE.md`. Adding a high-cardinality attribute to a metric (`user.id`, `team.id`, request IDs) will blow up Prometheus memory. PR review gate.
4. **Edge runtime stays tracing-only.** Middleware's `console.warn` / `console.error` stay. Edge-compatible log export is a separate design.
5. **SSE span lifecycle.** Span-not-closing-on-client-disconnect is the standard SSE instrumentation bug. Plan includes explicit `AbortSignal` wiring and a regression test.

## Success criteria

1. `npm run infra:up` brings up Loki alongside the existing stack; all containers healthy.
2. A `team.update` / `team.run` / `team.designer.propose` call produces a span in Jaeger, a metric series in Prometheus, and a structured log in Grafana → Loki.
3. Clicking `TraceID` in a Loki log row opens the matching Jaeger trace inside Grafana.
4. The `agent-teams.json` dashboard renders all four panels with real data after exercising the feature.
5. `npm test` and `npm run test:integration` stay green; coverage threshold holds.
6. No new `console.*` calls added; existing ones untouched.
