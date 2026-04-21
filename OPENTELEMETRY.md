# OpenTelemetry

Project-specific conventions. For the spec, see [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/) and [W3C Trace Context](https://www.w3.org/TR/trace-context/).

## Pipeline

```
Next.js app ─OTLP/HTTP(:4318)→ OTEL Collector ─→ Jaeger (traces)
                                              └→ Prometheus (metrics)
```

All three run locally via `npm run infra:up` — see [infra/README.md](./infra/README.md).

## Entry point

`src/instrumentation.ts` is Next.js's instrumentation hook. It dispatches per-runtime:

- `src/lib/telemetry/instrumentation.node.ts` — Node runtime (auto-instruments HTTP, Prisma, etc.)
- `src/lib/telemetry/instrumentation.edge.ts` — Edge runtime (minimal; middleware only)

Don't import either directly — Next.js calls them through the hook.

## Writing spans

Use `createSpan` from `src/lib/telemetry/tracing.ts`:

```ts
import { createSpan } from '@/lib/telemetry/tracing'

export async function provisionUser(entraOid: string) {
  return createSpan('auth.provision', async (span) => {
    span.setAttribute('actor.entraOid', entraOid)
    // ... work ...
    span.addEvent('auth.user_upserted')
    return result
  })
}
```

Exceptions are recorded and the span is marked `ERROR` automatically when the callback throws.

## Span naming

Keep names stable — they're aggregated in Jaeger/Prometheus dashboards.

| Kind | Pattern | Examples |
|---|---|---|
| HTTP handler | `http.{METHOD}.{route}` | `http.GET./auth/callback`, `http.POST./api/thing` |
| DB operation | `db.{operation}.{table}` | `db.select.users`, `db.update.users` |
| Business logic | `{domain}.{verb}` | `auth.callback`, `auth.provision` |

## Attributes

Follow [semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — prefix matters. Use `http.method`, `http.status_code`, `db.system`, `db.statement` — not `method`, `statusCode`.

Keep cardinality low: `user.id` yes, `user.email` no.

## Env vars

```bash
OTEL_SERVICE_NAME=nextjs-boilerplate
OTEL_SERVICE_VERSION=0.1.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0                   # 100% in dev; lower in prod (e.g., 0.1)
```

## Viewing data

- **Traces** — http://localhost:16686 · filter by service `nextjs-boilerplate` + operation name.
- **Metrics** — http://localhost:9090 · PromQL, e.g., `rate(http_server_duration_count[5m])`.
- **Dashboards** — http://localhost:3001 (`admin`/`admin`) · provisioned JSON in `infra/grafana/dashboards/`.

## Troubleshooting

**No traces showing up.**
1. `docker logs otel-collector | grep -i trace` — collector receiving?
2. `echo $OTEL_EXPORTER_OTLP_ENDPOINT` — should be `http://localhost:4318`
3. `curl http://localhost:13133/` — collector health endpoint

**Missing attributes.** Make sure the instrumentation hook ran. If a span is created before `instrumentation.node.ts` finishes booting, it attaches to the no-op provider. In this project that only matters for code that runs at module load — route handlers are safe.

**High memory on the collector.** Lower batch sizes in `infra/otel-collector-config.yaml`:
```yaml
batch: { timeout: 5s, send_batch_size: 512 }
```
