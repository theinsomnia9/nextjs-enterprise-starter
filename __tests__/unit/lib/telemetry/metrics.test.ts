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
