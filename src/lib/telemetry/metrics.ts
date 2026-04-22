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
import {
  metrics,
  type Meter,
  type Counter,
  type Histogram,
  type MetricAttributes,
  type Context,
} from '@opentelemetry/api'

const METER_NAME = 'nextjs-boilerplate'
const METER_VERSION = '0.1.0'

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

// Instruments are created lazily on first use so that callers can cache them at
// module scope without racing SDK startup. If a service module is imported
// before the MeterProvider is registered, eagerly-created instruments bind to a
// no-op meter and silently drop every observation for the process lifetime.

export function createCounter(name: string, opts: InstrumentOptions = {}): Counter {
  if (!name) throw new Error('createCounter: name is required')
  let delegate: Counter | null = null
  const resolve = (): Counter => {
    if (!delegate) {
      delegate = getMeter().createCounter(name, {
        description: opts.description,
        unit: opts.unit,
      })
    }
    return delegate
  }
  return {
    add(value: number, attributes?: MetricAttributes, context?: Context) {
      resolve().add(value, attributes, context)
    },
  }
}

export function createHistogram(name: string, opts: HistogramOptions = {}): Histogram {
  if (!name) throw new Error('createHistogram: name is required')
  let delegate: Histogram | null = null
  const resolve = (): Histogram => {
    if (!delegate) {
      delegate = getMeter().createHistogram(name, {
        description: opts.description,
        unit: opts.unit,
        advice: opts.advice,
      })
    }
    return delegate
  }
  return {
    record(value: number, attributes?: MetricAttributes, context?: Context) {
      resolve().record(value, attributes, context)
    },
  }
}
