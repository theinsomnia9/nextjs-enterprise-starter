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
