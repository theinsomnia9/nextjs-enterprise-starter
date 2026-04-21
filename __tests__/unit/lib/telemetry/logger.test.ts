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
