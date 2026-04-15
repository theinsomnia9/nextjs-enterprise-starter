import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api'

const tracer = trace.getTracer('nextjs-boilerplate', '0.1.0')

export function createSpan(name: string, fn: (span: Span) => Promise<unknown>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}

export function getCurrentSpan() {
  return trace.getSpan(context.active())
}

export function addSpanAttribute(key: string, value: string | number | boolean) {
  const span = getCurrentSpan()
  if (span) {
    span.setAttribute(key, value)
  }
}

export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>) {
  const span = getCurrentSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}
