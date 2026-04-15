# OpenTelemetry Implementation Guide

This project implements comprehensive observability using OpenTelemetry standards with traces, metrics, and logs exported to Jaeger and Prometheus.

## Architecture

```
Next.js App
    ↓ (OTLP/HTTP)
OpenTelemetry Collector
    ├─→ Jaeger (Traces)
    ├─→ Prometheus (Metrics)
    └─→ Console (Development Logs)
```

## OpenTelemetry Standards Compliance

### Semantic Conventions

We follow [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/) for all telemetry data:

#### Resource Attributes

```typescript
{
  [SemanticResourceAttributes.SERVICE_NAME]: 'nextjs-boilerplate',
  [SemanticResourceAttributes.SERVICE_VERSION]: '0.1.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'development'
}
```

#### HTTP Semantic Conventions

For HTTP operations:
- `http.method` - HTTP request method
- `http.url` - Full HTTP request URL
- `http.status_code` - HTTP response status code
- `http.user_agent` - User agent string
- `http.route` - Matched route (e.g., `/api/users/:id`)

#### Database Semantic Conventions

For database operations:
- `db.system` - Database system (e.g., `postgresql`)
- `db.name` - Database name
- `db.statement` - Database query
- `db.operation` - Operation name (e.g., `SELECT`, `INSERT`)

### W3C Trace Context

All traces use [W3C Trace Context](https://www.w3.org/TR/trace-context/) propagation:

```
traceparent: 00-{trace-id}-{span-id}-{flags}
tracestate: vendor1=value1,vendor2=value2
```

This ensures trace context propagates correctly across:
- Frontend to backend requests
- API route calls
- Database operations
- External service calls

## Configuration

### Environment Variables

```bash
# Service identification
OTEL_SERVICE_NAME="nextjs-boilerplate"
OTEL_SERVICE_VERSION="0.1.0"

# Exporter configuration
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"

# Sampling
OTEL_TRACES_SAMPLER="parentbased_traceidratio"
OTEL_TRACES_SAMPLER_ARG="1.0"  # 100% sampling in dev, reduce in production

# Environment
NODE_ENV="development"
```

### Collector Configuration

Located in `infra/otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024
  
  memory_limiter:
    check_interval: 1s
    limit_mib: 512

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true
  
  prometheus:
    endpoint: "0.0.0.0:8889"
```

## Instrumentation

### Backend (Node.js)

Auto-instrumentation is configured in `src/lib/telemetry/instrumentation.node.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

const sdk = new NodeSDK({
  resource: new Resource({...}),
  traceExporter: new OTLPTraceExporter({...}),
  metricReader: new PeriodicExportingMetricReader({...}),
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()
```

This automatically instruments:
- HTTP/HTTPS requests
- Next.js API routes
- Database queries (via Prisma)
- File system operations

### Frontend (Browser)

Browser instrumentation (to be implemented):

```typescript
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'

const provider = new WebTracerProvider({...})
registerInstrumentations({
  instrumentations: [new FetchInstrumentation()]
})
```

## Creating Custom Spans

### Using the Tracing Utility

```typescript
import { createSpan } from '@/lib/telemetry/tracing'

async function processWorkflow(workflowId: string) {
  return createSpan('workflow.process', async (span) => {
    // Add attributes
    span.setAttribute('workflow.id', workflowId)
    span.setAttribute('workflow.type', 'automation')
    
    // Add events
    span.addEvent('workflow.started')
    
    try {
      const result = await executeWorkflow(workflowId)
      
      span.addEvent('workflow.completed', {
        'workflow.steps': result.steps.length,
        'workflow.duration': result.duration
      })
      
      return result
    } catch (error) {
      // Exceptions are automatically recorded
      throw error
    }
  })
}
```

### Manual Span Creation

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('my-service')

async function myFunction() {
  const span = tracer.startSpan('operation-name', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'custom.attribute': 'value'
    }
  })
  
  try {
    // Your code here
    span.setStatus({ code: SpanStatusCode.OK })
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    })
    span.recordException(error)
    throw error
  } finally {
    span.end()
  }
}
```

## Span Naming Conventions

Follow these patterns for consistent span names:

### API Routes

```
http.{method}.{route}

Examples:
- http.GET./api/users
- http.POST./api/workflows
- http.GET./api/chat/:id
```

### Database Operations

```
db.{operation}.{table}

Examples:
- db.select.users
- db.insert.messages
- db.update.workflows
```

### Business Logic

```
{domain}.{operation}

Examples:
- workflow.execute
- chat.send_message
- auth.verify_token
```

## Adding Context to Spans

### Common Attributes

```typescript
span.setAttribute('user.id', userId)
span.setAttribute('workflow.id', workflowId)
span.setAttribute('chat.room', roomId)
span.setAttribute('message.length', messageContent.length)
```

### Events

```typescript
span.addEvent('cache.hit', {
  'cache.key': cacheKey,
  'cache.ttl': 300
})

span.addEvent('validation.failed', {
  'validation.field': 'email',
  'validation.error': 'invalid format'
})
```

### Error Recording

```typescript
try {
  await operation()
} catch (error) {
  span.recordException(error)
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  })
  throw error
}
```

## Metrics

### Custom Metrics

```typescript
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('nextjs-boilerplate')

// Counter
const requestCounter = meter.createCounter('http.requests', {
  description: 'Total HTTP requests',
  unit: '1'
})

requestCounter.add(1, {
  'http.method': 'GET',
  'http.route': '/api/users'
})

// Histogram
const requestDuration = meter.createHistogram('http.request.duration', {
  description: 'HTTP request duration',
  unit: 'ms'
})

requestDuration.record(durationMs, {
  'http.method': 'GET',
  'http.status_code': 200
})
```

### Workflow Metrics

```typescript
const workflowExecutions = meter.createCounter('workflow.executions')
const workflowDuration = meter.createHistogram('workflow.duration')
const activeWorkflows = meter.createUpDownCounter('workflow.active')

// Track execution
workflowExecutions.add(1, {
  'workflow.status': 'completed',
  'workflow.type': 'automation'
})

// Track duration
workflowDuration.record(executionTimeMs, {
  'workflow.id': workflowId
})
```

## Viewing Telemetry Data

### Jaeger UI

Access at http://localhost:16686

**Features:**
- Search traces by service, operation, tags
- View trace timeline and span details
- Analyze service dependencies
- Compare traces

**Common Queries:**
```
service=nextjs-boilerplate operation=workflow.execute
tags: {workflow.status="failed"}
duration: >1000ms
```

### Prometheus

Access at http://localhost:9090

**Example Queries:**
```promql
# Request rate
rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])
```

### Grafana Dashboards

Access at http://localhost:3001

Pre-configured dashboards:
1. **Next.js Overview** - Request rates, latencies, errors
2. **Database Performance** - Query metrics, connection pool
3. **Workflow Analytics** - Execution stats, success rates
4. **Infrastructure** - Resource usage, collector metrics

## Best Practices

### 1. Use Semantic Attributes

✅ Good:
```typescript
span.setAttribute('http.method', 'POST')
span.setAttribute('http.status_code', 201)
```

❌ Bad:
```typescript
span.setAttribute('method', 'POST')
span.setAttribute('statusCode', 201)
```

### 2. Add Meaningful Events

```typescript
span.addEvent('validation.started')
span.addEvent('database.query.prepared')
span.addEvent('cache.miss', { 'cache.key': key })
```

### 3. Set Proper Span Status

```typescript
// Success
span.setStatus({ code: SpanStatusCode.OK })

// Error
span.setStatus({
  code: SpanStatusCode.ERROR,
  message: 'Validation failed'
})
```

### 4. Keep Span Cardinality Low

❌ Avoid:
```typescript
span.setAttribute('user.email', email) // High cardinality
```

✅ Better:
```typescript
span.setAttribute('user.id', userId) // Low cardinality
```

### 5. Use Appropriate Span Kinds

```typescript
import { SpanKind } from '@opentelemetry/api'

// For API endpoints
tracer.startSpan('operation', { kind: SpanKind.SERVER })

// For external calls
tracer.startSpan('operation', { kind: SpanKind.CLIENT })

// For internal operations
tracer.startSpan('operation', { kind: SpanKind.INTERNAL })
```

## Sampling Strategies

### Development

```bash
OTEL_TRACES_SAMPLER="always_on"
```

### Production

```bash
# Sample 10% of traces
OTEL_TRACES_SAMPLER="traceidratio"
OTEL_TRACES_SAMPLER_ARG="0.1"

# Or use parent-based sampling
OTEL_TRACES_SAMPLER="parentbased_traceidratio"
OTEL_TRACES_SAMPLER_ARG="0.1"
```

### Error Sampling

Always sample errors:
```typescript
const shouldSample = error || Math.random() < samplingRate
```

## Performance Considerations

### Batch Processing

Collector batches telemetry before export:
```yaml
processors:
  batch:
    timeout: 10s
    send_batch_size: 1024
```

### Memory Limits

```yaml
processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
```

### Async Export

Telemetry export is non-blocking and doesn't impact request latency.

## Troubleshooting

### No Traces in Jaeger

1. Check collector logs:
   ```bash
   docker logs otel-collector
   ```

2. Verify endpoint configuration:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT
   ```

3. Check collector health:
   ```bash
   curl http://localhost:13133/
   ```

### High Memory Usage

Reduce batch sizes:
```yaml
batch:
  timeout: 5s
  send_batch_size: 512
```

### Missing Attributes

Ensure instrumentation is initialized before app starts:
```typescript
// This runs first
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/telemetry/instrumentation.node')
  }
}
```

## Resources

- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/)
- [Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Collector Documentation](https://opentelemetry.io/docs/collector/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
