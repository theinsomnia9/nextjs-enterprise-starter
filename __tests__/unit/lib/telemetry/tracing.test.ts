import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpanStatusCode } from '@opentelemetry/api'

// Mock @opentelemetry/api before importing the module under test
const mockSpan = {
  setAttribute: vi.fn(),
  setStatus: vi.fn(),
  recordException: vi.fn(),
  addEvent: vi.fn(),
  end: vi.fn(),
}

const mockStartActiveSpan = vi.fn((_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) => {
  return fn(mockSpan)
})

const mockGetSpan = vi.fn()

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: mockStartActiveSpan,
    }),
    getSpan: (...args: unknown[]) => mockGetSpan(...args),
  },
  context: {
    active: vi.fn(() => 'mock-context'),
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}))

describe('tracing utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSpan', () => {
    it('should create an active span and execute the callback', async () => {
      const { createSpan } = await import('@/lib/telemetry/tracing')

      const result = await createSpan('test.operation', async (span) => {
        span.setAttribute('test.key', 'value')
        return 'success'
      })

      expect(result).toBe('success')
      expect(mockStartActiveSpan).toHaveBeenCalledWith('test.operation', expect.any(Function))
    })

    it('should set OK status on successful execution', async () => {
      const { createSpan } = await import('@/lib/telemetry/tracing')

      await createSpan('test.operation', async () => {
        return 'done'
      })

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK })
      expect(mockSpan.end).toHaveBeenCalled()
    })

    it('should set ERROR status and record exception on failure', async () => {
      const { createSpan } = await import('@/lib/telemetry/tracing')
      const testError = new Error('test failure')

      await expect(
        createSpan('test.operation', async () => {
          throw testError
        })
      ).rejects.toThrow('test failure')

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'test failure',
      })
      expect(mockSpan.recordException).toHaveBeenCalledWith(testError)
      expect(mockSpan.end).toHaveBeenCalled()
    })

    it('should handle non-Error thrown values', async () => {
      const { createSpan } = await import('@/lib/telemetry/tracing')

      await expect(
        createSpan('test.operation', async () => {
          throw 'string error'
        })
      ).rejects.toThrow('string error')

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Unknown error',
      })
      expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('getCurrentSpan', () => {
    it('should return the current active span', async () => {
      mockGetSpan.mockReturnValue(mockSpan)
      const { getCurrentSpan } = await import('@/lib/telemetry/tracing')

      const span = getCurrentSpan()

      expect(span).toBe(mockSpan)
      expect(mockGetSpan).toHaveBeenCalledWith('mock-context')
    })
  })

  describe('addSpanAttribute', () => {
    it('should add attribute to the current span', async () => {
      mockGetSpan.mockReturnValue(mockSpan)
      const { addSpanAttribute } = await import('@/lib/telemetry/tracing')

      addSpanAttribute('user.id', '123')

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('user.id', '123')
    })

    it('should handle numeric attribute values', async () => {
      mockGetSpan.mockReturnValue(mockSpan)
      const { addSpanAttribute } = await import('@/lib/telemetry/tracing')

      addSpanAttribute('http.status_code', 200)

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200)
    })

    it('should handle boolean attribute values', async () => {
      mockGetSpan.mockReturnValue(mockSpan)
      const { addSpanAttribute } = await import('@/lib/telemetry/tracing')

      addSpanAttribute('cache.hit', true)

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('cache.hit', true)
    })

    it('should do nothing when no active span exists', async () => {
      mockGetSpan.mockReturnValue(undefined)
      const { addSpanAttribute } = await import('@/lib/telemetry/tracing')

      addSpanAttribute('key', 'value')

      expect(mockSpan.setAttribute).not.toHaveBeenCalled()
    })
  })

  describe('addSpanEvent', () => {
    it('should add event to the current span', async () => {
      mockGetSpan.mockReturnValue(mockSpan)
      const { addSpanEvent } = await import('@/lib/telemetry/tracing')

      addSpanEvent('cache.miss', { 'cache.key': 'users:1' })

      expect(mockSpan.addEvent).toHaveBeenCalledWith('cache.miss', { 'cache.key': 'users:1' })
    })

    it('should add event without attributes', async () => {
      mockGetSpan.mockReturnValue(mockSpan)
      const { addSpanEvent } = await import('@/lib/telemetry/tracing')

      addSpanEvent('request.started')

      expect(mockSpan.addEvent).toHaveBeenCalledWith('request.started', undefined)
    })

    it('should do nothing when no active span exists', async () => {
      mockGetSpan.mockReturnValue(undefined)
      const { addSpanEvent } = await import('@/lib/telemetry/tracing')

      addSpanEvent('some.event')

      expect(mockSpan.addEvent).not.toHaveBeenCalled()
    })
  })
})
