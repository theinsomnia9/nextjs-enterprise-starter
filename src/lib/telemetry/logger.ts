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

function errorOverload(_msg: string, a?: Error | LogAttrs, b?: LogAttrs): LogAttrs {
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
