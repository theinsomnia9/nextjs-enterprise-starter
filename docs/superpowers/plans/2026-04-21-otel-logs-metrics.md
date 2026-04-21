# OpenTelemetry logs + metrics expansion — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire OpenTelemetry logs and metrics alongside the existing tracing setup, add Loki as the logs backend with log↔trace correlation in Grafana, and ship three concrete Team Builder instrumentation examples (service method, long-running SSE operation, LLM call).

**Architecture:** All telemetry lives under `src/lib/telemetry/` and is re-exported from a single barrel. A new `resource.ts` is the single source of truth for service identity and is used by the trace, metric, and **new** logger providers. Structured logs are emitted through a thin wrapper over `@opentelemetry/api-logs` that auto-attaches `trace_id`/`span_id` from the active span. Metrics use cached counter/histogram instruments. A new `loki` service is added to `infra/docker-compose.yml`, the collector gains a logs pipeline, and Grafana gains Loki + Jaeger datasources with derived-field click-through. Three Team Builder sites are instrumented as copy-pasteable patterns for future features.

**Tech Stack:** OpenTelemetry SDK (`@opentelemetry/{api,api-logs,sdk-node,sdk-logs,sdk-metrics,exporter-logs-otlp-http}` at `^0.215.0` / `^1.x`), Next.js 16 `instrumentation.ts` hook, Grafana Loki 3.2.0, Prometheus, Jaeger, vitest 4, Playwright (not used in this plan), docker-compose.

**Spec:** [`docs/superpowers/specs/2026-04-21-otel-logs-metrics-design.md`](../specs/2026-04-21-otel-logs-metrics-design.md)

**Branch:** `feat/otel-logs-metrics` (already created).

---

## File map

| Path | Status | Responsibility |
|---|---|---|
| `src/lib/telemetry/resource.ts` | NEW | Single `buildResource()` — service.name/version/deployment.environment |
| `src/lib/telemetry/metrics.ts` | NEW | `getMeter`, `createCounter`, `createHistogram` with name cache |
| `src/lib/telemetry/logger.ts` | NEW | `logger` + `childLogger` — OTLP log record emit + stdout mirror + trace correlation |
| `src/lib/telemetry/index.ts` | NEW | Barrel re-export |
| `src/lib/telemetry/instrumentation.node.ts` | MODIFY | Use shared `buildResource()`, add `LoggerProvider` + OTLP log exporter |
| `src/lib/telemetry/tracing.ts` | unchanged | — |
| `infra/docker-compose.yml` | MODIFY | Add `loki` service + `loki-data` volume |
| `infra/loki/local-config.yaml` | NEW | Single-node filesystem Loki config |
| `infra/otel-collector-config.yaml` | MODIFY | `otlphttp/loki` exporter + logs pipeline |
| `infra/grafana/provisioning/datasources/loki.yml` | NEW | Loki datasource with `TraceID` derived field |
| `infra/grafana/provisioning/datasources/jaeger.yml` | NEW | Jaeger datasource (so derived-field link target resolves) |
| `infra/grafana/dashboards/agent-teams.json` | NEW | 4-panel dashboard |
| `src/services/agentTeamService.ts` | MODIFY | Instrument `update()` |
| `src/app/api/agent-teams/[id]/run/route.ts` | MODIFY | Instrument SSE run with lifecycle tied to `AbortSignal` |
| `src/lib/agentTeams/designer.ts` | MODIFY | Instrument `runDesigner` |
| `__tests__/unit/lib/telemetry/resource.test.ts` | NEW | env-var precedence |
| `__tests__/unit/lib/telemetry/metrics.test.ts` | NEW | instrument caching |
| `__tests__/unit/lib/telemetry/logger.test.ts` | NEW | trace-id autoattach, level filter, error overload |
| `__tests__/unit/services/agentTeamService.test.ts` | NEW | asserts logger/counter/histogram calls on update() |
| `__tests__/integration/telemetry/pipeline.test.ts` | NEW | in-memory end-to-end for update() |
| `.env.example` | MODIFY | document `LOG_LEVEL` |
| `CLAUDE.md` | MODIFY | one-line pointer + low-cardinality rule |
| `package.json` | MODIFY | add 3 deps |

---

## Conventions used in this plan

- Service name is **`nextjs-boilerplate`** (single word, matches existing `.env.example`).
- Prometheus exporter has `namespace: nextjs` — OTel metric `agent_team.save.total` becomes `nextjs_agent_team_save_total` in PromQL, and histograms get `_milliseconds` in the bucket/sum/count series when unit is `ms`.
- Every task ends in a commit. Commit message prefix uses existing repo style (`feat(telemetry): …`, `chore(infra): …`, `test(telemetry): …`).
- Do NOT skip hooks (`--no-verify`). If a hook fails, fix the root cause.
- Run tests after each code change. Do not claim a task complete if tests or typecheck fail.

---

## Task 1 — Add log SDK dependencies

**Files:**
- Modify: `package.json` (dependencies block)

- [ ] **Step 1: Install the three packages**

Run:
```bash
npm install \
  @opentelemetry/api-logs@^0.215.0 \
  @opentelemetry/sdk-logs@^0.215.0 \
  @opentelemetry/exporter-logs-otlp-http@^0.215.0
```

Expected: three lines added to `dependencies` in `package.json`, `package-lock.json` updated, no peer-dep warnings for `@opentelemetry/api` (already `^1.9.1`).

- [ ] **Step 2: Sanity-check resolved versions**

Run:
```bash
npm ls @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-http
```

Expected: all three resolved at `^0.215.0` (the exact patch version matching the other OTel packages is fine; minor/patch drift within `0.215.x` is OK).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(telemetry): add OpenTelemetry logs SDK deps"
```

---

## Task 2 — Extract `resource.ts` (single source of truth for service identity)

**Files:**
- Create: `src/lib/telemetry/resource.ts`
- Create: `__tests__/unit/lib/telemetry/resource.test.ts`
- Modify: `src/lib/telemetry/instrumentation.node.ts` (lines 37–42 — replace inlined `resourceFromAttributes` with call to `buildResource()`)

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/telemetry/resource.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn((attrs: Record<string, unknown>) => ({ attributes: attrs })),
}))

vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}))

vi.mock('@opentelemetry/semantic-conventions/incubating', () => ({
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME: 'deployment.environment',
}))

describe('buildResource', () => {
  const originalEnv = { ...process.env }
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('defaults service.name to nextjs-boilerplate when OTEL_SERVICE_NAME unset', async () => {
    delete process.env.OTEL_SERVICE_NAME
    delete process.env.OTEL_SERVICE_VERSION
    delete process.env.NODE_ENV
    const { buildResource } = await import('@/lib/telemetry/resource')
    const r = buildResource() as { attributes: Record<string, string> }
    expect(r.attributes['service.name']).toBe('nextjs-boilerplate')
    expect(r.attributes['service.version']).toBe('0.1.0')
    expect(r.attributes['deployment.environment']).toBe('development')
  })

  it('reads OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION, NODE_ENV from env', async () => {
    process.env.OTEL_SERVICE_NAME = 'my-service'
    process.env.OTEL_SERVICE_VERSION = '9.9.9'
    process.env.NODE_ENV = 'production'
    const { buildResource } = await import('@/lib/telemetry/resource')
    const r = buildResource() as { attributes: Record<string, string> }
    expect(r.attributes['service.name']).toBe('my-service')
    expect(r.attributes['service.version']).toBe('9.9.9')
    expect(r.attributes['deployment.environment']).toBe('production')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run __tests__/unit/lib/telemetry/resource.test.ts
```

Expected: FAIL — cannot find module `@/lib/telemetry/resource`.

- [ ] **Step 3: Write `resource.ts`**

Create `src/lib/telemetry/resource.ts`:

```ts
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating'
import type { Resource } from '@opentelemetry/resources'

export function buildResource(): Resource {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'nextjs-boilerplate',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '0.1.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run __tests__/unit/lib/telemetry/resource.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Refactor `instrumentation.node.ts` to use it**

Replace lines 37–42 of `src/lib/telemetry/instrumentation.node.ts`.

**Old (lines 37–42):**
```ts
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'nextjs-boilerplate',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '0.1.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
  }),
```

**New:**
```ts
const sdk = new NodeSDK({
  resource: buildResource(),
```

Also remove now-unused imports at the top of the file:
- `import { resourceFromAttributes } from '@opentelemetry/resources'`
- `import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'`
- `import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating'`

Add:
```ts
import { buildResource } from './resource'
```

- [ ] **Step 6: Typecheck and test**

Run:
```bash
npx tsc --noEmit
npm run test:unit -- __tests__/unit/lib/telemetry
```

Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/telemetry/resource.ts src/lib/telemetry/instrumentation.node.ts __tests__/unit/lib/telemetry/resource.test.ts
git commit -m "feat(telemetry): extract buildResource() as single source of truth"
```

---

## Task 3 — Build `metrics.ts` helpers

**Files:**
- Create: `src/lib/telemetry/metrics.ts`
- Create: `__tests__/unit/lib/telemetry/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/telemetry/metrics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCounter = { add: vi.fn() }
const mockHistogram = { record: vi.fn() }
const mockMeter = {
  createCounter: vi.fn(() => mockCounter),
  createHistogram: vi.fn(() => mockHistogram),
}

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(() => mockMeter),
  },
}))

describe('metrics helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('getMeter returns a meter from the global MeterProvider', async () => {
    const { getMeter } = await import('@/lib/telemetry/metrics')
    const m = getMeter('my-module')
    expect(m).toBe(mockMeter)
  })

  it('createCounter caches by name (same name returns same instrument)', async () => {
    const { createCounter } = await import('@/lib/telemetry/metrics')
    const c1 = createCounter('agent_team.save.total', { description: 'd', unit: '1' })
    const c2 = createCounter('agent_team.save.total')
    expect(c1).toBe(c2)
    expect(mockMeter.createCounter).toHaveBeenCalledTimes(1)
  })

  it('createHistogram caches by name and passes advice through', async () => {
    const { createHistogram } = await import('@/lib/telemetry/metrics')
    const h1 = createHistogram('agent_team.save.duration', {
      unit: 'ms',
      advice: { explicitBucketBoundaries: [10, 100, 1000] },
    })
    const h2 = createHistogram('agent_team.save.duration')
    expect(h1).toBe(h2)
    expect(mockMeter.createHistogram).toHaveBeenCalledTimes(1)
    expect(mockMeter.createHistogram).toHaveBeenCalledWith(
      'agent_team.save.duration',
      expect.objectContaining({
        unit: 'ms',
        advice: { explicitBucketBoundaries: [10, 100, 1000] },
      })
    )
  })

  it('different names return different counter instruments', async () => {
    const { createCounter } = await import('@/lib/telemetry/metrics')
    const c1 = createCounter('a.total')
    const c2 = createCounter('b.total')
    expect(mockMeter.createCounter).toHaveBeenCalledTimes(2)
    // both resolve to mockCounter since the mock always returns the same object,
    // but the important assertion is the cache key: two distinct createCounter calls were made
    expect(c1).toBeDefined()
    expect(c2).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run __tests__/unit/lib/telemetry/metrics.test.ts
```

Expected: FAIL — cannot find module `@/lib/telemetry/metrics`.

- [ ] **Step 3: Write `metrics.ts`**

Create `src/lib/telemetry/metrics.ts`:

```ts
/**
 * Metrics helpers built on the global MeterProvider.
 *
 * Naming conventions:
 *   - Counters:   <domain>.<noun>.total    e.g. agent_team.save.total
 *   - Histograms: <domain>.<verb>.duration e.g. agent_team.save.duration  (unit: 'ms')
 *
 * Cardinality rule: metric attribute values MUST be low-cardinality enums.
 * NEVER put user.id, team.id, trace_id, request IDs, free-form strings,
 * or unbounded values on a metric attribute. Those belong on spans and log records.
 * Violating this rule will blow up Prometheus memory.
 */
import { metrics, type Meter, type Counter, type Histogram } from '@opentelemetry/api'

const METER_NAME = 'nextjs-boilerplate'
const METER_VERSION = '0.1.0'

const counters = new Map<string, Counter>()
const histograms = new Map<string, Histogram>()

export function getMeter(name: string = METER_NAME): Meter {
  return metrics.getMeter(name, METER_VERSION)
}

export interface InstrumentOptions {
  description?: string
  unit?: string
}

export interface HistogramOptions extends InstrumentOptions {
  advice?: { explicitBucketBoundaries?: number[] }
}

export function createCounter(name: string, opts: InstrumentOptions = {}): Counter {
  if (!name) throw new Error('createCounter: name is required')
  const cached = counters.get(name)
  if (cached) return cached
  const counter = getMeter().createCounter(name, {
    description: opts.description,
    unit: opts.unit,
  })
  counters.set(name, counter)
  return counter
}

export function createHistogram(name: string, opts: HistogramOptions = {}): Histogram {
  if (!name) throw new Error('createHistogram: name is required')
  const cached = histograms.get(name)
  if (cached) return cached
  const histogram = getMeter().createHistogram(name, {
    description: opts.description,
    unit: opts.unit,
    advice: opts.advice,
  })
  histograms.set(name, histogram)
  return histogram
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run __tests__/unit/lib/telemetry/metrics.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/telemetry/metrics.ts __tests__/unit/lib/telemetry/metrics.test.ts
git commit -m "feat(telemetry): add metrics helpers with instrument caching"
```

---

## Task 4 — Build `logger.ts`

**Files:**
- Create: `src/lib/telemetry/logger.ts`
- Create: `__tests__/unit/lib/telemetry/logger.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/telemetry/logger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockEmit = vi.fn()
const mockLogger = { emit: mockEmit }

const mockSpanContext = { traceId: 'trace-abc', spanId: 'span-xyz', traceFlags: 1 }
const mockSpan = { spanContext: () => mockSpanContext }

vi.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: vi.fn(() => mockLogger),
  },
  SeverityNumber: {
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
  },
}))

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: vi.fn(() => mockSpan),
  },
}))

describe('logger', () => {
  const originalEnv = { ...process.env }
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('emits an OTel log record with severity INFO for logger.info', async () => {
    const { logger } = await import('@/lib/telemetry/logger')
    logger.info('hello', { key: 'v' })
    expect(mockEmit).toHaveBeenCalledTimes(1)
    const call = mockEmit.mock.calls[0][0]
    expect(call.severityNumber).toBe(9)
    expect(call.severityText).toBe('INFO')
    expect(call.body).toBe('hello')
    expect(call.attributes).toMatchObject({ key: 'v' })
  })

  it('auto-attaches trace_id and span_id from the active span', async () => {
    const { logger } = await import('@/lib/telemetry/logger')
    logger.info('hi')
    const call = mockEmit.mock.calls[0][0]
    expect(call.attributes.trace_id).toBe('trace-abc')
    expect(call.attributes.span_id).toBe('span-xyz')
  })

  it('skips trace/span ids when no active span', async () => {
    const { trace } = await import('@opentelemetry/api')
    ;(trace.getActiveSpan as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined)
    const { logger } = await import('@/lib/telemetry/logger')
    logger.info('hi')
    const call = mockEmit.mock.calls[0][0]
    expect(call.attributes.trace_id).toBeUndefined()
    expect(call.attributes.span_id).toBeUndefined()
  })

  it('logger.error with Error attaches error.name, error.message, error.stack', async () => {
    const { logger } = await import('@/lib/telemetry/logger')
    const err = new Error('boom')
    err.stack = 'STACK'
    logger.error('save failed', err, { teamId: 't1' })
    const call = mockEmit.mock.calls[0][0]
    expect(call.severityNumber).toBe(17)
    expect(call.attributes).toMatchObject({
      'error.name': 'Error',
      'error.message': 'boom',
      'error.stack': 'STACK',
      teamId: 't1',
    })
  })

  it('logger.error without Error just uses attrs', async () => {
    const { logger } = await import('@/lib/telemetry/logger')
    logger.error('plain error', { code: 42 })
    const call = mockEmit.mock.calls[0][0]
    expect(call.attributes).toMatchObject({ code: 42 })
    expect(call.attributes['error.name']).toBeUndefined()
  })

  it('filters stdout by LOG_LEVEL but still emits OTel records', async () => {
    process.env.LOG_LEVEL = 'warn'
    stdoutSpy.mockClear()
    const { logger } = await import('@/lib/telemetry/logger')
    logger.info('below threshold')
    logger.warn('at threshold')
    // OTel always gets both
    expect(mockEmit).toHaveBeenCalledTimes(2)
    // stdout only gets warn
    expect(stdoutSpy).toHaveBeenCalledTimes(1)
  })

  it('childLogger binds base attributes merged into every record', async () => {
    const { childLogger } = await import('@/lib/telemetry/logger')
    const log = childLogger({ route: 'POST /x' })
    log.info('hit', { userId: 'u1' })
    const call = mockEmit.mock.calls[0][0]
    expect(call.attributes).toMatchObject({ route: 'POST /x', userId: 'u1' })
  })

  it('childLogger overrides are applied per-call (caller wins on key collision)', async () => {
    const { childLogger } = await import('@/lib/telemetry/logger')
    const log = childLogger({ route: 'base' })
    log.info('hit', { route: 'override' })
    const call = mockEmit.mock.calls[0][0]
    expect(call.attributes.route).toBe('override')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run __tests__/unit/lib/telemetry/logger.test.ts
```

Expected: FAIL — cannot find module `@/lib/telemetry/logger`.

- [ ] **Step 3: Write `logger.ts`**

Create `src/lib/telemetry/logger.ts`:

```ts
/**
 * Structured logger on top of @opentelemetry/api-logs.
 *
 * Every call:
 *   1. Emits an OTel LogRecord via the global LoggerProvider (ships to collector → Loki)
 *   2. Mirrors to stdout (JSON line; filtered by LOG_LEVEL)
 *   3. Attaches trace_id / span_id from the active span if any
 *
 * Callers NEVER pass trace_id / span_id by hand.
 */
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { trace } from '@opentelemetry/api'

export type LogAttrs = Record<string, string | number | boolean | null | undefined>

type Level = 'debug' | 'info' | 'warn' | 'error'

const SEVERITY_NUMBER: Record<Level, number> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

const SEVERITY_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function minLevel(): Level {
  const raw = (process.env.LOG_LEVEL || 'info').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw
  return 'info'
}

function getOtelLogger() {
  return logs.getLogger('nextjs-boilerplate', '0.1.0')
}

function activeTraceAttrs(): LogAttrs {
  const span = trace.getActiveSpan()
  if (!span) return {}
  const ctx = span.spanContext()
  if (!ctx || !ctx.traceId) return {}
  return { trace_id: ctx.traceId, span_id: ctx.spanId }
}

function errorToAttrs(err: Error): LogAttrs {
  return {
    'error.name': err.name,
    'error.message': err.message,
    'error.stack': err.stack,
  }
}

function write(level: Level, msg: string, attrs: LogAttrs) {
  const merged: LogAttrs = { ...activeTraceAttrs(), ...attrs }

  // OTel export — always, regardless of LOG_LEVEL (collector-side filtering is the right place for ingest reduction)
  getOtelLogger().emit({
    severityNumber: SEVERITY_NUMBER[level],
    severityText: level.toUpperCase(),
    body: msg,
    attributes: merged,
  })

  // stdout mirror — filtered
  if (SEVERITY_RANK[level] < SEVERITY_RANK[minLevel()]) return
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...merged,
  })
  process.stdout.write(line + '\n')
}

function isError(x: unknown): x is Error {
  return x instanceof Error
}

function errorOverload(msg: string, a?: Error | LogAttrs, b?: LogAttrs): LogAttrs {
  if (a === undefined) return {}
  if (isError(a)) return { ...errorToAttrs(a), ...(b || {}) }
  return a
}

function makeLogger(base: LogAttrs = {}) {
  return {
    debug(msg: string, attrs?: LogAttrs) {
      write('debug', msg, { ...base, ...(attrs || {}) })
    },
    info(msg: string, attrs?: LogAttrs) {
      write('info', msg, { ...base, ...(attrs || {}) })
    },
    warn(msg: string, attrs?: LogAttrs) {
      write('warn', msg, { ...base, ...(attrs || {}) })
    },
    error(msg: string, a?: Error | LogAttrs, b?: LogAttrs) {
      write('error', msg, { ...base, ...errorOverload(msg, a, b) })
    },
  }
}

export const logger = makeLogger()
export function childLogger(baseAttrs: LogAttrs): ReturnType<typeof makeLogger> {
  return makeLogger(baseAttrs)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run __tests__/unit/lib/telemetry/logger.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/telemetry/logger.ts __tests__/unit/lib/telemetry/logger.test.ts
git commit -m "feat(telemetry): add structured logger with trace correlation"
```

---

## Task 5 — Wire `LoggerProvider` into `instrumentation.node.ts`

**Files:**
- Modify: `src/lib/telemetry/instrumentation.node.ts`

- [ ] **Step 1: Read current file state**

Confirm the file already imports `buildResource` (Task 2). If not, Task 2 was skipped — stop and complete Task 2 first.

- [ ] **Step 2: Add the LoggerProvider wiring**

After the existing `sdk.start()` line (currently line 58), add the following block before the `process.on('SIGTERM', …)` handler:

```ts
import { logs } from '@opentelemetry/api-logs'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
```
(imports go at the top of the file with the others)

And below `sdk.start()`:

```ts
const logExporter = new OTLPLogExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`
    : 'http://localhost:4318/v1/logs',
})

const loggerProvider = new LoggerProvider({
  resource: buildResource(),
  processors: [new BatchLogRecordProcessor(logExporter)],
})

logs.setGlobalLoggerProvider(loggerProvider)
```

- [ ] **Step 3: Extend SIGTERM shutdown to flush the LoggerProvider**

Replace the existing SIGTERM block (lines 60–66) with:

```ts
process.on('SIGTERM', () => {
  Promise.allSettled([sdk.shutdown(), loggerProvider.shutdown()])
    .then(() => console.log('OpenTelemetry SDK + LoggerProvider shut down successfully'))
    .catch((error) => console.error('Error shutting down OpenTelemetry', error))
    .finally(() => process.exit(0))
})
```

- [ ] **Step 4: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean. If the `processors` key on `LoggerProvider` is rejected by the installed version, fall back to the addLogRecordProcessor API:

```ts
const loggerProvider = new LoggerProvider({ resource: buildResource() })
loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter))
```

- [ ] **Step 5: Smoke-test that dev boot doesn't crash**

Run:
```bash
npm run dev
```

Wait for the Next.js "Ready" line in the terminal. Then Ctrl-C.

Expected: no unhandled rejection, no module-not-found errors. (It's fine if no OTLP log export actually succeeds — the collector may not be up. We're just verifying the hook wires up without exploding.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/telemetry/instrumentation.node.ts
git commit -m "feat(telemetry): register LoggerProvider with OTLP log exporter"
```

---

## Task 6 — Build `index.ts` barrel

**Files:**
- Create: `src/lib/telemetry/index.ts`

- [ ] **Step 1: Write the barrel**

Create `src/lib/telemetry/index.ts`:

```ts
export { createSpan, getCurrentSpan, addSpanAttribute, addSpanEvent } from './tracing'
export { getMeter, createCounter, createHistogram } from './metrics'
export type { InstrumentOptions, HistogramOptions } from './metrics'
export { logger, childLogger } from './logger'
export type { LogAttrs } from './logger'
export { buildResource } from './resource'
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Smoke-import from a throwaway file**

Run:
```bash
node -e "require('tsx/cjs'); require('./src/lib/telemetry/index.ts')" 2>&1 | head -5
```

If `tsx` isn't installed, skip this step — the tsc check above is sufficient.

- [ ] **Step 4: Commit**

```bash
git add src/lib/telemetry/index.ts
git commit -m "feat(telemetry): add barrel re-export module"
```

---

## Task 7 — Add Loki to docker-compose

**Files:**
- Modify: `infra/docker-compose.yml`
- Create: `infra/loki/local-config.yaml`

- [ ] **Step 1: Create the Loki config**

Create `infra/loki/local-config.yaml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096
  log_level: info

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

compactor:
  working_directory: /loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  delete_request_store: filesystem

limits_config:
  retention_period: 168h           # 7 days
  allow_structured_metadata: true
  volume_enabled: true
  otlp_config:
    resource_attributes:
      attributes_config:
        - action: index_label
          attributes:
            - service.name
            - service.namespace
            - deployment.environment

ruler:
  alertmanager_url: http://localhost:9093
```

- [ ] **Step 2: Add the Loki service to docker-compose**

Open `infra/docker-compose.yml`. After the `jaeger:` service block (ends around line 70), insert:

```yaml
  loki:
    image: grafana/loki:3.2.0
    container_name: loki
    command: ['-config.file=/etc/loki/local-config.yaml']
    volumes:
      - ./loki/local-config.yaml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    ports:
      - '3100:3100'
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3100/ready']
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

- [ ] **Step 3: Add `loki_data` to the volumes block**

In the same file, update the top-level `volumes:` block (lines 128–132) from:

```yaml
volumes:
  postgres_data:
  postgres_test_data:
  prometheus_data:
  grafana_data:
```

to:

```yaml
volumes:
  postgres_data:
  postgres_test_data:
  prometheus_data:
  grafana_data:
  loki_data:
```

- [ ] **Step 4: Add `loki` to `otel-collector.depends_on`**

Update the `otel-collector` service's `depends_on` block (lines 48–50) from:

```yaml
    depends_on:
      - jaeger
      - prometheus
```

to:

```yaml
    depends_on:
      - jaeger
      - prometheus
      - loki
```

- [ ] **Step 5: Start infra and verify Loki is healthy**

Run:
```bash
npm run infra:up
```

Wait ~60 seconds, then run:
```bash
docker ps --filter name=loki --format "{{.Status}}"
curl -s http://localhost:3100/ready
```

Expected: container status includes `(healthy)`, `curl` returns `ready`.

If Loki fails to start, inspect with `docker logs loki`. The most common cause is the config YAML not matching Loki 3.2.0's schema — verify the config file was copied into the container with `docker exec loki cat /etc/loki/local-config.yaml`.

- [ ] **Step 6: Tear down**

Run:
```bash
npm run infra:down
```

- [ ] **Step 7: Commit**

```bash
git add infra/docker-compose.yml infra/loki/local-config.yaml
git commit -m "chore(infra): add Loki 3.2.0 service with filesystem storage"
```

---

## Task 8 — Add logs pipeline to collector config

**Files:**
- Modify: `infra/otel-collector-config.yaml`

- [ ] **Step 1: Add the Loki exporter and logs pipeline**

Open `infra/otel-collector-config.yaml`. Under the `exporters:` block (around line 33), after the existing `logging:` exporter, append:

```yaml
  # Loki for logs (native OTLP ingest in Loki 3.x)
  otlphttp/loki:
    endpoint: http://loki:3100/otlp
    tls:
      insecure: true
```

Under the `service.pipelines:` block (around line 50), add a new `logs:` pipeline after `metrics:`:

```yaml
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [otlphttp/loki, logging]
```

- [ ] **Step 2: Start infra and verify the collector accepts the config**

Run:
```bash
npm run infra:up
```

Wait ~60 seconds. Then:
```bash
docker logs otel-collector 2>&1 | tail -30
```

Expected: the `logs` pipeline appears in the startup banner; no `cannot unmarshal` or `unknown exporter` errors.

If the `otlphttp/loki` exporter errors at startup, Loki 3.2.0 may not have accepted the endpoint path. Fall back plan: switch the exporter to the contrib collector's native `loki` exporter:

```yaml
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
```

and use `[loki, logging]` in the logs pipeline. The contrib image (`otel/opentelemetry-collector-contrib:0.100.0`) already includes this exporter.

- [ ] **Step 3: Smoke-test — send a test log record**

With infra still running:
```bash
curl -X POST http://localhost:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"smoke-test"}}]},"scopeLogs":[{"logRecords":[{"timeUnixNano":"'"$(date +%s)"'000000000","severityNumber":9,"severityText":"INFO","body":{"stringValue":"hello from curl"}}]}]}]}'
```

Expected: HTTP 200/204 response. Then:
```bash
curl -s -G 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={service_name="smoke-test"}' \
  --data-urlencode "start=$(date -u -v-5M +%s)000000000" \
  --data-urlencode "end=$(date -u +%s)000000000" | head -20
```

Expected: a JSON response with a `result` array containing the `hello from curl` line.

If the result is empty, inspect `docker logs otel-collector` for export errors.

- [ ] **Step 4: Tear down**

Run:
```bash
npm run infra:down
```

- [ ] **Step 5: Commit**

```bash
git add infra/otel-collector-config.yaml
git commit -m "chore(infra): add logs pipeline to OTel collector"
```

---

## Task 9 — Add Grafana Loki + Jaeger datasources

**Files:**
- Create: `infra/grafana/provisioning/datasources/loki.yml`
- Create: `infra/grafana/provisioning/datasources/jaeger.yml`

- [ ] **Step 1: Create the Jaeger datasource**

Create `infra/grafana/provisioning/datasources/jaeger.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Jaeger
    uid: jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    isDefault: false
    editable: true
```

- [ ] **Step 2: Create the Loki datasource with derived field**

Create `infra/grafana/provisioning/datasources/loki.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    uid: loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
    jsonData:
      derivedFields:
        - name: TraceID
          matcherType: label
          matcherRegex: trace_id
          datasourceUid: jaeger
          url: ''
          urlDisplayLabel: 'View trace'
```

Note: `matcherType: label` tells Grafana to extract the value from the log record's indexed label `trace_id`, not from a regex over the body. This matches how our logger attaches `trace_id` as a record attribute, which Loki 3.x with `allow_structured_metadata: true` exposes as structured metadata.

If the `label` matcher type is not supported by the Grafana version (10.4.2), fall back to:

```yaml
      derivedFields:
        - name: TraceID
          matcherRegex: '"trace_id":"(\w+)"'
          datasourceUid: jaeger
```

which greps the JSON stdout mirror instead.

- [ ] **Step 3: Start infra and verify datasources are provisioned**

Run:
```bash
npm run infra:up
```

Wait ~60 seconds, then visit `http://localhost:3001` (admin/admin). Navigate to Connections → Data sources. Expect to see three: Prometheus, Loki, Jaeger.

Click into each and hit "Save & test":
- Prometheus: "Data source is working" ✓
- Loki: "Data source successfully connected" ✓
- Jaeger: "Data source is working" ✓

- [ ] **Step 4: Tear down**

Run:
```bash
npm run infra:down
```

- [ ] **Step 5: Commit**

```bash
git add infra/grafana/provisioning/datasources/loki.yml infra/grafana/provisioning/datasources/jaeger.yml
git commit -m "chore(infra): provision Loki + Jaeger Grafana datasources"
```

---

## Task 10 — Add `agent-teams.json` dashboard

**Files:**
- Create: `infra/grafana/dashboards/agent-teams.json`

- [ ] **Step 1: Write the dashboard JSON**

Create `infra/grafana/dashboards/agent-teams.json`:

```json
{
  "title": "Agent Teams",
  "uid": "agent-teams",
  "schemaVersion": 39,
  "version": 1,
  "tags": ["nextjs-boilerplate", "agent-teams"],
  "time": { "from": "now-1h", "to": "now" },
  "refresh": "30s",
  "panels": [
    {
      "id": 1,
      "type": "timeseries",
      "title": "Save rate by result",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "sum by (result) (rate(nextjs_agent_team_save_total[5m]))",
          "legendFormat": "{{result}}",
          "refId": "A"
        }
      ],
      "fieldConfig": { "defaults": { "custom": { "drawStyle": "bars", "stacking": { "mode": "normal" } } } }
    },
    {
      "id": 2,
      "type": "timeseries",
      "title": "Save latency (ms) — p50 / p95 / p99",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        { "expr": "histogram_quantile(0.50, sum by (le) (rate(nextjs_agent_team_save_duration_milliseconds_bucket[5m])))", "legendFormat": "p50", "refId": "A" },
        { "expr": "histogram_quantile(0.95, sum by (le) (rate(nextjs_agent_team_save_duration_milliseconds_bucket[5m])))", "legendFormat": "p95", "refId": "B" },
        { "expr": "histogram_quantile(0.99, sum by (le) (rate(nextjs_agent_team_save_duration_milliseconds_bucket[5m])))", "legendFormat": "p99", "refId": "C" }
      ]
    },
    {
      "id": 3,
      "type": "timeseries",
      "title": "Run events by type",
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "targets": [
        {
          "expr": "sum by (event_type) (rate(nextjs_agent_team_run_events_total[5m]))",
          "legendFormat": "{{event_type}}",
          "refId": "A"
        }
      ],
      "fieldConfig": { "defaults": { "custom": { "drawStyle": "line", "stacking": { "mode": "normal" } } } }
    },
    {
      "id": 4,
      "type": "logs",
      "title": "Agent Teams logs",
      "gridPos": { "h": 10, "w": 24, "x": 0, "y": 16 },
      "datasource": { "type": "loki", "uid": "loki" },
      "targets": [
        {
          "expr": "{service_name=\"nextjs-boilerplate\"} |= \"agent_team\"",
          "refId": "A"
        }
      ],
      "options": {
        "showTime": true,
        "wrapLogMessage": true,
        "enableLogDetails": true
      }
    }
  ]
}
```

Note on panel 2's metric name: Prometheus suffixes histogram bucket series with `_bucket`, and the collector's OTLP-to-Prom converter converts OTel unit `ms` to `milliseconds` in the metric name. If after exercising the feature this series doesn't appear, check the actual name in Prometheus at `http://localhost:9090/api/v1/label/__name__/values | jq | grep save_duration` and adjust the panel.

- [ ] **Step 2: Start infra and verify the dashboard loads**

Run:
```bash
npm run infra:up
```

Wait ~60 seconds, open `http://localhost:3001` → Dashboards → Agent Teams. Expect all four panels to render (they'll be empty until we instrument and exercise the feature in later tasks — that's fine).

- [ ] **Step 3: Tear down**

Run:
```bash
npm run infra:down
```

- [ ] **Step 4: Commit**

```bash
git add infra/grafana/dashboards/agent-teams.json
git commit -m "chore(infra): add Agent Teams Grafana dashboard"
```

---

## Task 11 — Instrument `agentTeamService.update()` (Example 1)

**Files:**
- Modify: `src/services/agentTeamService.ts`
- Create: `__tests__/unit/services/agentTeamService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/services/agentTeamService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentTeamService } from '@/services/agentTeamService'
import type { IAgentTeamRepository } from '@/lib/agentTeams/repository'
import type { AgentTeamDetail, TeamDefinition } from '@/lib/agentTeams/types'

const mockLoggerInfo = vi.fn()
const mockLoggerWarn = vi.fn()
const mockLoggerError = vi.fn()
const mockCounterAdd = vi.fn()
const mockHistogramRecord = vi.fn()
const mockCreateSpan = vi.fn((_name: string, fn: (span: unknown) => Promise<unknown>) =>
  fn({ setAttribute: vi.fn() })
)

vi.mock('@/lib/telemetry', () => ({
  logger: {
    debug: vi.fn(),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
  createCounter: vi.fn(() => ({ add: mockCounterAdd })),
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  createSpan: (...args: Parameters<typeof mockCreateSpan>) => mockCreateSpan(...args),
  addSpanAttribute: vi.fn(),
}))

const minimalDefinition: TeamDefinition = {
  version: 1,
  nodes: [{ id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: { kind: 'trigger', label: 'Trigger' } }],
  edges: [],
  metadata: { title: 'T', description: '' },
}

const baseTeam: AgentTeamDetail = {
  id: 'team-1',
  name: 'Team One',
  description: null,
  isActive: true,
  createdById: 'user-1',
  definition: minimalDefinition,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRepo(overrides: Partial<IAgentTeamRepository> = {}): IAgentTeamRepository {
  return {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => baseTeam),
    create: vi.fn(async () => baseTeam),
    update: vi.fn(async (_id, patch) => ({ ...baseTeam, ...patch })),
    delete: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('AgentTeamService.update telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits save.total=ok and save.duration on success', async () => {
    const svc = new AgentTeamService({ repository: makeRepo() })
    await svc.update('team-1', 'user-1', { name: 'renamed' })
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'ok' }))
    expect(mockHistogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ result: 'ok' })
    )
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'agent_team.save',
      expect.objectContaining({ teamId: 'team-1', result: 'ok' })
    )
  })

  it('wraps the call in a createSpan("team.update")', async () => {
    const svc = new AgentTeamService({ repository: makeRepo() })
    await svc.update('team-1', 'user-1', { name: 'x' })
    expect(mockCreateSpan).toHaveBeenCalledWith('team.update', expect.any(Function))
  })

  it('emits result=forbidden when caller is not the owner', async () => {
    const svc = new AgentTeamService({
      repository: makeRepo({ findById: vi.fn(async () => ({ ...baseTeam, createdById: 'someone-else' })) }),
    })
    await expect(svc.update('team-1', 'user-1', { name: 'x' })).rejects.toThrow()
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'forbidden' }))
  })

  it('emits result=not_found when team missing', async () => {
    const svc = new AgentTeamService({
      repository: makeRepo({ findById: vi.fn(async () => null) }),
    })
    await expect(svc.update('team-1', 'user-1', { name: 'x' })).rejects.toThrow()
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'not_found' }))
  })

  it('emits result=validation_error when definition is invalid', async () => {
    const badDefinition = { version: 1, nodes: [], edges: [], metadata: { title: '' } } as unknown as TeamDefinition
    const svc = new AgentTeamService({ repository: makeRepo() })
    await expect(
      svc.update('team-1', 'user-1', { definition: badDefinition })
    ).rejects.toThrow()
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'validation_error' }))
    expect(mockLoggerWarn).toHaveBeenCalled()
  })

  it('emits result=error on unexpected repo failure', async () => {
    const svc = new AgentTeamService({
      repository: makeRepo({ update: vi.fn(async () => { throw new Error('db boom') }) }),
    })
    await expect(svc.update('team-1', 'user-1', { name: 'x' })).rejects.toThrow('db boom')
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'error' }))
    expect(mockLoggerError).toHaveBeenCalledWith(
      'agent_team.save failed',
      expect.any(Error),
      expect.objectContaining({ teamId: 'team-1' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run __tests__/unit/services/agentTeamService.test.ts
```

Expected: FAIL — the service doesn't emit any telemetry yet.

- [ ] **Step 3: Rewrite `agentTeamService.ts` update()**

Open `src/services/agentTeamService.ts`. Add imports at the top:

```ts
import { createSpan, createCounter, createHistogram, logger } from '@/lib/telemetry'
import { AppError } from '@/lib/errors/AppError'

const saveTotal = createCounter('agent_team.save.total', {
  description: 'Agent team save operations, labeled by result.',
  unit: '1',
})

const saveDuration = createHistogram('agent_team.save.duration', {
  description: 'Duration of agent team save operations.',
  unit: 'ms',
})

type SaveResult = 'ok' | 'validation_error' | 'forbidden' | 'not_found' | 'error'

function classifyError(err: unknown): SaveResult {
  if (err instanceof AppError) {
    if (err.code === 'NOT_FOUND') return 'not_found'
    if (err.code === 'FORBIDDEN') return 'forbidden'
    if (err.code === 'VALIDATION_ERROR') return 'validation_error'
  }
  return 'error'
}
```

Note: confirm the exact `err.code` strings by reading `src/lib/errors/AppError.ts`. Adjust the `classifyError` function to match (the names there may be different — e.g., `notFound` may produce `code: 'NOT_FOUND'` or the factory name itself). Run the test and adjust until `result` labels match.

Replace the `update()` method body (currently lines 47–65) with:

```ts
async update(
  id: string,
  ownerId: string,
  patch: {
    name?: string
    description?: string | null
    definition?: TeamDefinition
    isActive?: boolean
  }
): Promise<AgentTeamDetail> {
  return createSpan('team.update', async (span) => {
    const startedAt = performance.now()
    let result: SaveResult = 'ok'
    try {
      const current = await this.get(id, ownerId)
      const changedFields = Object.keys(patch).filter(
        (k) => (patch as Record<string, unknown>)[k] !== undefined
      )
      span.setAttribute('team.id', id)
      span.setAttribute('user.id', ownerId)
      span.setAttribute('changed_fields', changedFields.join(','))

      if (patch.definition) {
        const report = validateTeamDefinition(patch.definition)
        if (!report.ok) {
          result = 'validation_error'
          logger.warn('agent_team.save', {
            teamId: id,
            result,
            issueCount: report.issues.length,
          })
          throw validationError('Team definition is invalid', { issues: report.issues })
        }
      }

      const updated = await this.repo.update(id, patch)
      logger.info('agent_team.save', {
        teamId: id,
        changedFields: changedFields.join(','),
        result,
      })
      return updated
    } catch (err) {
      if (result === 'ok') result = classifyError(err)
      if (result === 'error') {
        logger.error('agent_team.save failed', err as Error, { teamId: id })
      }
      throw err
    } finally {
      const durationMs = performance.now() - startedAt
      saveTotal.add(1, { result })
      saveDuration.record(durationMs, { result })
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run __tests__/unit/services/agentTeamService.test.ts
```

Expected: all 6 tests PASS.

If the `classifyError` mapping is off, inspect `src/lib/errors/AppError.ts` and adjust the `.code` checks to match the actual `AppError.code` values. The test intentionally drives this.

- [ ] **Step 5: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/services/agentTeamService.ts __tests__/unit/services/agentTeamService.test.ts
git commit -m "feat(telemetry): instrument agentTeamService.update (Example 1)"
```

---

## Task 12 — Instrument SSE run route (Example 2)

**Files:**
- Modify: `src/app/api/agent-teams/[id]/run/route.ts`
- Create: `__tests__/unit/app/api/agent-teams/runInstrumentation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/app/api/agent-teams/runInstrumentation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCounterAdd = vi.fn()
const mockHistogramRecord = vi.fn()
const mockSetAttribute = vi.fn()
const mockLoggerInfo = vi.fn()
const mockLoggerError = vi.fn()

const mockSpan = { setAttribute: mockSetAttribute, end: vi.fn() }
const mockCreateSpan = vi.fn((_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) =>
  fn(mockSpan)
)

vi.mock('@/lib/telemetry', () => ({
  createSpan: (...args: Parameters<typeof mockCreateSpan>) => mockCreateSpan(...args),
  createCounter: vi.fn((name: string) =>
    name === 'agent_team.run.total'
      ? { add: (n: number, attrs: Record<string, string>) => mockCounterAdd('total', n, attrs) }
      : { add: (n: number, attrs: Record<string, string>) => mockCounterAdd('events', n, attrs) }
  ),
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  logger: {
    debug: vi.fn(),
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    warn: vi.fn(),
    error: (...a: unknown[]) => mockLoggerError(...a),
  },
  addSpanEvent: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: vi.fn(async () => ({ id: 'user-1' })) }))

vi.mock('@/services/agentTeamService', () => ({
  agentTeamService: {
    get: vi.fn(async () => ({
      id: 'team-1',
      definition: { version: 1, nodes: [{ id: 'a' }, { id: 'b' }], edges: [], metadata: {} },
    })),
  },
}))

vi.mock('@/lib/agentTeams/executor', () => ({
  executeTeam: vi.fn(async function* () {
    yield { type: 'run_started', teamId: 'team-1' }
    yield { type: 'node_started', nodeId: 'a', label: 'A', kind: 'agent' }
    yield { type: 'node_completed', nodeId: 'a', outputPreview: 'ok' }
    yield { type: 'final', output: 'done' }
  }),
}))

vi.mock('@/lib/api/withApi', () => ({
  withApi: (_name: string, fn: unknown) => fn,
}))

describe('POST /api/agent-teams/[id]/run instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits a team.run span, increments run.events.total per event, and records duration on success', async () => {
    const { POST } = await import('@/app/api/agent-teams/[id]/run/route')
    const req = new Request('http://localhost/api/agent-teams/team-1/run', {
      method: 'POST',
      body: JSON.stringify({ input: 'hi' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await (POST as (r: Request, ctx: unknown) => Promise<Response>)(req, {
      params: Promise.resolve({ id: 'team-1' }),
    })
    // drain the stream to completion
    const reader = res.body!.getReader()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(mockCreateSpan).toHaveBeenCalledWith('team.run', expect.any(Function))
    expect(mockSetAttribute).toHaveBeenCalledWith('team.id', 'team-1')
    expect(mockSetAttribute).toHaveBeenCalledWith('user.id', 'user-1')
    expect(mockSetAttribute).toHaveBeenCalledWith('node_count', 2)
    expect(mockSetAttribute).toHaveBeenCalledWith('run.status', 'completed')

    // one "total" increment per run
    expect(mockCounterAdd).toHaveBeenCalledWith(
      'total',
      1,
      expect.objectContaining({ result: 'ok' })
    )
    // 4 event increments (one per yielded event)
    const eventCalls = mockCounterAdd.mock.calls.filter((c) => c[0] === 'events')
    expect(eventCalls).toHaveLength(4)
    expect(mockHistogramRecord).toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith('agent_team.run.start', expect.any(Object))
    expect(mockLoggerInfo).toHaveBeenCalledWith('agent_team.run.end', expect.any(Object))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run __tests__/unit/app/api/agent-teams/runInstrumentation.test.ts
```

Expected: FAIL — nothing is instrumented yet.

- [ ] **Step 3: Rewrite the route to add instrumentation**

Replace the contents of `src/app/api/agent-teams/[id]/run/route.ts` with:

```ts
import { withApi } from '@/lib/api/withApi'
import { getActor } from '@/lib/auth/actor'
import { validationError } from '@/lib/errors/AppError'
import { runTeamSchema } from '@/lib/agentTeams/schemas'
import { agentTeamService } from '@/services/agentTeamService'
import { executeTeam } from '@/lib/agentTeams/executor'
import { SSE_HEADERS, SSE_DONE_FRAME } from '@/lib/sse/eventTypes'
import { createSpan, createCounter, createHistogram, logger, addSpanEvent } from '@/lib/telemetry'

const runTotal = createCounter('agent_team.run.total', {
  description: 'Agent team run completions, labeled by result.',
  unit: '1',
})

const runEvents = createCounter('agent_team.run.events.total', {
  description: 'Agent team run events emitted, labeled by event_type.',
  unit: '1',
})

const runDuration = createHistogram('agent_team.run.duration', {
  description: 'Duration of agent team runs.',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [10, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 30000, 60000, 150000, 300000],
  },
})

export const POST = withApi<{ id: string }>('agentTeams.run', async (req, { params }) => {
  const { id } = await params
  const actor = await getActor()
  const body = await req.json()
  const parsed = runTeamSchema.safeParse(body)
  if (!parsed.success) throw validationError(parsed.error.issues[0].message)

  const team = await agentTeamService.get(id, actor.id)

  return createSpan('team.run', async (span) => {
    const startedAt = performance.now()
    let runStatus: 'completed' | 'failed' | 'client_disconnect' = 'completed'
    let runResult: 'ok' | 'error' | 'client_disconnect' = 'ok'
    let sawError = false

    span.setAttribute('team.id', team.id)
    span.setAttribute('user.id', actor.id)
    span.setAttribute('node_count', team.definition.nodes.length)

    logger.info('agent_team.run.start', {
      teamId: team.id,
      userId: actor.id,
      nodeCount: team.definition.nodes.length,
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }
        try {
          for await (const ev of executeTeam({
            teamId: team.id,
            definition: team.definition,
            input: parsed.data.input,
            signal: req.signal,
          })) {
            runEvents.add(1, { event_type: ev.type })
            if (ev.type === 'node_started' || ev.type === 'node_completed' || ev.type === 'node_failed') {
              addSpanEvent(ev.type, { 'node.id': ev.nodeId })
            }
            send(ev)
            if (ev.type === 'error') {
              sawError = true
            }
            if (ev.type === 'final' || ev.type === 'error') break
          }
        } catch (err) {
          sawError = true
          const message = err instanceof Error ? err.message : 'Execution failed'
          send({ type: 'error', message })
          logger.error('agent_team.run failed', err as Error, { teamId: team.id })
        } finally {
          if (req.signal.aborted) {
            runStatus = 'client_disconnect'
            runResult = 'client_disconnect'
          } else if (sawError) {
            runStatus = 'failed'
            runResult = 'error'
          }
          const durationMs = performance.now() - startedAt
          span.setAttribute('run.status', runStatus)
          span.setAttribute('run.duration_ms', Math.round(durationMs))
          runTotal.add(1, { result: runResult })
          runDuration.record(durationMs, { result: runResult })
          logger.info('agent_team.run.end', {
            teamId: team.id,
            result: runResult,
            durationMs: Math.round(durationMs),
          })
          controller.enqueue(encoder.encode(SSE_DONE_FRAME))
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run __tests__/unit/app/api/agent-teams/runInstrumentation.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 5: Verify existing run-route tests (if any) still pass**

Run:
```bash
npm run test:unit -- agent-teams
```

Expected: all tests in any file touching `agent-teams` are green.

- [ ] **Step 6: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/agent-teams/\[id\]/run/route.ts __tests__/unit/app/api/agent-teams/runInstrumentation.test.ts
git commit -m "feat(telemetry): instrument SSE run route (Example 2)"
```

---

## Task 13 — Instrument `runDesigner` (Example 3)

**Files:**
- Modify: `src/lib/agentTeams/designer.ts`
- Create: `__tests__/unit/lib/agentTeams/designerInstrumentation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/lib/agentTeams/designerInstrumentation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateSpan = vi.fn((_name: string, fn: (span: { setAttribute: ReturnType<typeof vi.fn> }) => Promise<unknown>) =>
  fn({ setAttribute: vi.fn() })
)
const mockHistogramRecord = vi.fn()
const mockCounterAdd = vi.fn()
const mockLoggerInfo = vi.fn()

vi.mock('@/lib/telemetry', () => ({
  createSpan: (...args: Parameters<typeof mockCreateSpan>) => mockCreateSpan(...args),
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  createCounter: vi.fn(() => ({ add: mockCounterAdd })),
  logger: {
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockInvoke = vi.fn(async () => ({ rationale: 'ok', ops: [] }))
const mockWithStructuredOutput = vi.fn(() => ({ invoke: mockInvoke }))

vi.mock('@/lib/ai', () => ({
  getChatModel: vi.fn(() => ({ withStructuredOutput: mockWithStructuredOutput })),
  chatModelName: vi.fn(() => 'gpt-4o-mini'),
}))

describe('runDesigner instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LLM_PROVIDER = 'openai'
  })

  it('wraps the LLM call in a team.designer.propose span and records llm.call.duration', async () => {
    const { runDesigner } = await import('@/lib/agentTeams/designer')
    await runDesigner({
      message: 'add a researcher',
      current: { version: 1, nodes: [], edges: [], metadata: { title: 'x', description: '' } },
    })
    expect(mockCreateSpan).toHaveBeenCalledWith('team.designer.propose', expect.any(Function))
    expect(mockHistogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        provider: 'openai',
        operation: 'team_designer.propose',
      })
    )
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'llm.call',
      expect.objectContaining({
        provider: 'openai',
        operation: 'team_designer.propose',
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npx vitest run __tests__/unit/lib/agentTeams/designerInstrumentation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Instrument `runDesigner`**

Open `src/lib/agentTeams/designer.ts`. Add imports at the top (after the existing imports):

```ts
import { createSpan, createHistogram, createCounter, logger } from '@/lib/telemetry'
import { chatModelName } from '@/lib/ai'

const llmDuration = createHistogram('llm.call.duration', {
  description: 'Duration of LLM calls, labeled by provider/model/operation.',
  unit: 'ms',
})

const llmTokens = createCounter('llm.tokens.total', {
  description: 'LLM tokens consumed, labeled by provider/model/operation/direction.',
  unit: '1',
})
```

Replace the `runDesigner` function body (line 147 onward, replacing the entire `export async function runDesigner(...)` implementation) with:

```ts
export async function runDesigner(
  input: {
    message: string
    current: TeamDefinition
    history?: DesignerHistory[]
  },
  deps: DesignerDeps = {}
): Promise<{ diff: GraphDiff; reply: string }> {
  return createSpan('team.designer.propose', async (span) => {
    const provider = process.env.LLM_PROVIDER || 'openai'
    const model = deps.model || chatModelName()
    const temperature = 0
    const operation = 'team_designer.propose'

    span.setAttribute('llm.provider', provider)
    span.setAttribute('llm.model', model)
    span.setAttribute('llm.temperature', temperature)

    const llm = getChatModel({
      model: deps.model,
      temperature,
    }).withStructuredOutput(diffSchema, { name: 'propose_graph_diff' })

    const messages = [
      new SystemMessage(buildSystemPrompt(input.current)),
      ...(input.history ?? []).map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ),
      new HumanMessage(input.message),
    ]

    const startedAt = performance.now()
    let parsed
    try {
      parsed = await llm.invoke(messages)
    } finally {
      const durationMs = performance.now() - startedAt
      llmDuration.record(durationMs, { provider, model, operation })
      logger.info('llm.call', {
        provider,
        model,
        operation,
        durationMs: Math.round(durationMs),
      })
    }

    const cleaned = stripNulls(parsed)
    const diff: GraphDiff = {
      ops: cleaned.ops as GraphDiff['ops'],
      rationale: cleaned.rationale,
    }
    // Note: LangChain's withStructuredOutput doesn't surface token usage on the parsed output.
    // Token counting is a deliberate follow-up once we wire the raw Response (AIMessage) path.
    // When we do, use llmTokens.add(n, { provider, model, operation, direction }).
    void llmTokens
    return { diff, reply: cleaned.rationale }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run __tests__/unit/lib/agentTeams/designerInstrumentation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agentTeams/designer.ts __tests__/unit/lib/agentTeams/designerInstrumentation.test.ts
git commit -m "feat(telemetry): instrument runDesigner LLM call (Example 3)"
```

---

## Task 14 — Integration test — in-memory pipeline

**Files:**
- Create: `__tests__/integration/telemetry/pipeline.test.ts`

- [ ] **Step 1: Write the test**

Create `__tests__/integration/telemetry/pipeline.test.ts`:

```ts
/**
 * End-to-end telemetry integration test for Example 1 (agentTeamService.update).
 *
 * Wires in-memory OTel exporters, invokes the real service against the test DB,
 * and asserts that one span, one counter increment, one histogram observation,
 * and one log record were emitted with correlated trace/span IDs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NodeTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import {
  MeterProvider,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics'
import { LoggerProvider, InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { logs } from '@opentelemetry/api-logs'
import { trace, metrics } from '@opentelemetry/api'

import { PrismaClient } from '@prisma/client'
import { buildResource } from '@/lib/telemetry/resource'
import { AgentTeamService } from '@/services/agentTeamService'
import { agentTeamRepository } from '@/lib/agentTeams/repository'

const spanExporter = new InMemorySpanExporter()
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
const logExporter = new InMemoryLogRecordExporter()

const tracerProvider = new NodeTracerProvider({
  resource: buildResource(),
  spanProcessors: [new SimpleSpanProcessor(spanExporter)],
})
const meterProvider = new MeterProvider({
  resource: buildResource(),
  readers: [new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 100 })],
})
const loggerProvider = new LoggerProvider({ resource: buildResource() })
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter))

trace.setGlobalTracerProvider(tracerProvider)
metrics.setGlobalMeterProvider(meterProvider)
logs.setGlobalLoggerProvider(loggerProvider)

const prisma = new PrismaClient()
const svc = new AgentTeamService({ repository: agentTeamRepository })

describe('telemetry pipeline — agentTeamService.update', () => {
  let userId: string
  let teamId: string

  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { entraOid: `oid-${Date.now()}`, email: `t${Date.now()}@test.local`, name: 'Test' },
    })
    userId = u.id
    const team = await svc.create({
      name: 'Integration Team',
      description: null,
      createdById: userId,
    })
    teamId = team.id
  })

  afterAll(async () => {
    await prisma.agentTeam.deleteMany({ where: { id: teamId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
    await tracerProvider.shutdown()
    await meterProvider.shutdown()
    await loggerProvider.shutdown()
  })

  it('emits a span, counter increment, histogram observation, and a correlated log record', async () => {
    spanExporter.reset()
    metricExporter.reset()
    logExporter.reset()

    await svc.update(teamId, userId, { name: 'Renamed' })

    // wait for the metric reader to flush
    await new Promise((r) => setTimeout(r, 200))
    await meterProvider.forceFlush()
    await loggerProvider.forceFlush()
    await tracerProvider.forceFlush()

    const spans = spanExporter.getFinishedSpans()
    const updateSpan = spans.find((s) => s.name === 'team.update')
    expect(updateSpan).toBeDefined()

    const metricsData = metricExporter.getMetrics()
    const allMetrics = metricsData.flatMap((rm) => rm.scopeMetrics.flatMap((sm) => sm.metrics))
    const saveTotal = allMetrics.find((m) => m.descriptor.name === 'agent_team.save.total')
    const saveDuration = allMetrics.find((m) => m.descriptor.name === 'agent_team.save.duration')
    expect(saveTotal).toBeDefined()
    expect(saveDuration).toBeDefined()

    const saveLog = logExporter.getFinishedLogRecords().find((lr) => lr.body === 'agent_team.save')
    expect(saveLog).toBeDefined()
    expect(saveLog!.attributes!.trace_id).toBe(updateSpan!.spanContext().traceId)
    expect(saveLog!.attributes!.teamId).toBe(teamId)
    expect(saveLog!.attributes!.result).toBe('ok')
  })
})
```

- [ ] **Step 2: Ensure the integration DB is up**

Run:
```bash
docker ps --filter name=nextjs-postgres-test --format "{{.Status}}"
```

Expected: `Up … (healthy)`. If not:
```bash
npm run infra:up
```

- [ ] **Step 3: Run the integration test**

Run:
```bash
npm run test:integration -- __tests__/integration/telemetry/pipeline.test.ts
```

Expected: PASS. If `NodeTracerProvider` import from `@opentelemetry/sdk-trace-node` fails (not installed), add that dep:

```bash
npm install @opentelemetry/sdk-trace-node@^2.0.0
```

If `InMemoryMetricExporter` import fails, verify `@opentelemetry/sdk-metrics` version — it must expose `InMemoryMetricExporter`. If it doesn't in the installed version, swap to a minimal custom exporter that captures `export()` calls.

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/telemetry/pipeline.test.ts
git commit -m "test(telemetry): add in-memory pipeline integration test"
```

If a dep was added:
```bash
git add package.json package-lock.json
git commit -m "chore(telemetry): add sdk-trace-node for integration tests"
```

---

## Task 15 — Update `.env.example` + `CLAUDE.md`

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `.env.example`**

Open `.env.example`. Under the `# OpenTelemetry` block (currently lines 16–23), add one line:

```
# Stdout log level filter for the telemetry logger (debug | info | warn | error).
# Always emits to the OTel collector regardless; this only filters stdout mirror.
LOG_LEVEL="info"
```

- [ ] **Step 2: Update `CLAUDE.md`**

Open `CLAUDE.md`. Find the `### Telemetry` section (which currently only covers tracing). Replace it entirely with:

```markdown
### Telemetry

`src/instrumentation.ts` is the Next.js instrumentation hook. Node runtime uses `src/lib/telemetry/instrumentation.node.ts`; Edge runtime uses `.edge.ts`. All three pillars — traces, metrics, logs — share one `Resource` built by `src/lib/telemetry/resource.ts`.

Import everything from the barrel:

```ts
import { createSpan, createCounter, createHistogram, logger } from '@/lib/telemetry'
```

**Tracing:** wrap operations with `createSpan('domain.verb', async (span) => {...})`.

**Metrics:** cache instruments at module scope — `const saveTotal = createCounter('agent_team.save.total', { unit: '1' })`. Naming is `<domain>.<noun>.total` for counters, `<domain>.<verb>.duration` (unit `ms`) for histograms.

**Metric attribute cardinality rule:** metric attribute values must be low-cardinality enums. **Never** put `user.id`, `team.id`, request IDs, or free-form strings on a metric attribute — those belong on spans and log records. Violating this rule will blow up Prometheus memory.

**Logs:** `logger.info('event', { attrs })` and friends. Trace correlation (`trace_id` / `span_id`) is attached automatically from the active span. Use `logger.error(msg, err, attrs?)` for exceptions. `childLogger({ base })` binds scope attributes.

**Prometheus metric names:** the collector's `prometheus` exporter uses `namespace: nextjs`, so OTel metric `agent_team.save.total` becomes `nextjs_agent_team_save_total` in PromQL.

**Reference implementations** (copy these patterns for new features): `agentTeamService.update()`, `POST /api/agent-teams/[id]/run`, `runDesigner()` in `src/lib/agentTeams/designer.ts`.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs(telemetry): document LOG_LEVEL and metrics conventions"
```

---

## Task 16 — Full smoke test + PR description

**Files:** none modified; this is a verification + documentation task.

- [ ] **Step 1: Start infra from clean state**

Run:
```bash
npm run infra:down
npm run infra:up
```

Wait ~90 seconds for all health checks to pass.

Run:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected: `otel-collector`, `jaeger`, `prometheus`, `grafana`, `loki`, `nextjs-postgres`, `nextjs-postgres-test` all show `(healthy)`.

- [ ] **Step 2: Start the dev server**

Run:
```bash
npm run dev
```

Leave running in a separate terminal. Wait for "Ready" line.

- [ ] **Step 3: Sign in and exercise the feature**

In a browser:
1. Open `http://localhost:3000`, sign in
2. Navigate to Agent Teams, create a team (or open an existing one)
3. Rename it and save (triggers Example 1)
4. Click Run, submit an input (triggers Example 2)
5. Use the AI Designer panel to request a redesign (triggers Example 3)

- [ ] **Step 4: Verify traces in Jaeger**

Open `http://localhost:16686`. Select service `nextjs-boilerplate`. Expect traces named `team.update`, `team.run`, and `team.designer.propose` in the dropdown.

- [ ] **Step 5: Verify metrics in Prometheus**

Open `http://localhost:9090/graph`. Query:
```
nextjs_agent_team_save_total
nextjs_agent_team_run_events_total
```

Expect non-zero series after the exercise in Step 3.

- [ ] **Step 6: Verify logs and click-through in Grafana**

Open `http://localhost:3001` (admin/admin).

- Explore → Loki → `{service_name="nextjs-boilerplate"}`. Expect log rows including `agent_team.save`, `agent_team.run.start`, `agent_team.run.end`, `llm.call`.
- Expand a row. Confirm a `TraceID` derived field link is present.
- Click the `TraceID` link. Expect the matching Jaeger trace to open inside Grafana.
- Dashboards → Agent Teams. Expect all four panels to show data.

If the TraceID derived field is not showing on rows, the likely cause is that Loki 3.2.0's OTLP ingest is putting `trace_id` into structured metadata rather than as an indexed label — in which case `matcherType: label` won't match. Switch the derived field to the regex fallback (`matcherRegex: '"trace_id":"(\w+)"'`) so it matches the JSON stdout mirror that also flows through the collector when the stdout-to-OTLP bridge is active. If stdout isn't piped to the collector, the regex fallback requires you to pipe stdout through a log-file shipper, which is out of scope — in that case, accept structured-metadata-based TraceID and use Grafana's built-in log detail pane to click through, which still works without the derived field.

- [ ] **Step 7: Run the full test suite**

Run:
```bash
npm run test:unit
npm run test:integration
```

Expected: both green.

- [ ] **Step 8: Tear down**

Run:
```bash
# kill dev server (Ctrl-C in its terminal)
npm run infra:down
```

- [ ] **Step 9: Push the branch and open a PR**

Run:
```bash
git push -u origin feat/otel-logs-metrics
```

**Only do this step after explicit user confirmation** — pushing is a non-local action.

Use this PR description template (via `gh pr create`):

```
## Summary
- Wire OpenTelemetry logs and metrics alongside existing tracing
- Add Loki 3.2.0 as log backend with OTLP ingest and Grafana log↔trace correlation
- Introduce `src/lib/telemetry/{resource,metrics,logger,index}.ts` helpers
- Instrument three Team Builder operations as reference patterns

## Test plan
- [ ] `npm run test:unit` green
- [ ] `npm run test:integration` green
- [ ] `npm run infra:up` — all containers healthy
- [ ] Team save → trace in Jaeger + metric in Prometheus + log in Loki (trace-correlated)
- [ ] Team run → `nextjs_agent_team_run_events_total` has expected event types
- [ ] Designer proposal → `llm.call.duration` observation
- [ ] Grafana "Agent Teams" dashboard renders all 4 panels
- [ ] Clicking TraceID in a Loki log row opens matching Jaeger trace in Grafana
```

---

## Self-review checklist (run before declaring the plan complete)

- [ ] Every spec requirement has a task (file layout, helpers, infra, 3 examples, dashboard, testing, rollout)
- [ ] No `TBD`, `TODO`, `implement later`, `add appropriate error handling`, `similar to Task N`
- [ ] `classifyError` handling in Task 11 depends on actual `AppError.code` strings — Step 3 explicitly notes this and ties the mapping to test outcomes
- [ ] Metric names match between definition sites, dashboard queries, and smoke-test queries (`nextjs_agent_team_save_total`, `nextjs_agent_team_save_duration_milliseconds_bucket`, `nextjs_agent_team_run_events_total`)
- [ ] Service name is `nextjs-boilerplate` everywhere (not `nextjs-boiler-plate`)
- [ ] Every test step has a matching "run to verify failure" step before implementation
- [ ] SSE span lifecycle explicitly handles `req.signal.aborted` in Task 12 finally block
- [ ] Loki 3.2.0 risk has a documented fallback (contrib collector's native `loki` exporter) in Task 8
- [ ] Derived-field label-matcher risk has a documented fallback (regex matcher) in Task 9 and Task 16 Step 6
- [ ] No mention of migrating existing `console.*` calls outside the three Example sites
