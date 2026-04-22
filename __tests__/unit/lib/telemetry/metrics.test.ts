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

  it('createCounter defers underlying instrument creation until first add()', async () => {
    const { createCounter } = await import('@/lib/telemetry/metrics')
    const c = createCounter('agent_team.save.total', { description: 'd', unit: '1' })
    expect(mockMeter.createCounter).not.toHaveBeenCalled()
    c.add(1, { result: 'ok' })
    expect(mockMeter.createCounter).toHaveBeenCalledTimes(1)
    expect(mockMeter.createCounter).toHaveBeenCalledWith(
      'agent_team.save.total',
      expect.objectContaining({ description: 'd', unit: '1' })
    )
    expect(mockCounter.add).toHaveBeenCalledWith(1, { result: 'ok' }, undefined)
  })

  it('createCounter resolves the underlying counter once and reuses it', async () => {
    const { createCounter } = await import('@/lib/telemetry/metrics')
    const c = createCounter('agent_team.save.total')
    c.add(1)
    c.add(1)
    c.add(1)
    expect(mockMeter.createCounter).toHaveBeenCalledTimes(1)
    expect(mockCounter.add).toHaveBeenCalledTimes(3)
  })

  it('createHistogram defers creation and passes advice through on first record()', async () => {
    const { createHistogram } = await import('@/lib/telemetry/metrics')
    const h = createHistogram('agent_team.save.duration', {
      unit: 'ms',
      advice: { explicitBucketBoundaries: [10, 100, 1000] },
    })
    expect(mockMeter.createHistogram).not.toHaveBeenCalled()
    h.record(42)
    expect(mockMeter.createHistogram).toHaveBeenCalledTimes(1)
    expect(mockMeter.createHistogram).toHaveBeenCalledWith(
      'agent_team.save.duration',
      expect.objectContaining({
        unit: 'ms',
        advice: { explicitBucketBoundaries: [10, 100, 1000] },
      })
    )
    expect(mockHistogram.record).toHaveBeenCalledWith(42, undefined, undefined)
  })

  it('different names create distinct underlying instruments on first use', async () => {
    const { createCounter } = await import('@/lib/telemetry/metrics')
    const c1 = createCounter('a.total')
    const c2 = createCounter('b.total')
    c1.add(1)
    c2.add(1)
    expect(mockMeter.createCounter).toHaveBeenCalledTimes(2)
    expect(mockMeter.createCounter).toHaveBeenNthCalledWith(1, 'a.total', expect.any(Object))
    expect(mockMeter.createCounter).toHaveBeenNthCalledWith(2, 'b.total', expect.any(Object))
  })

  it('createCounter throws when name is empty', async () => {
    const { createCounter } = await import('@/lib/telemetry/metrics')
    expect(() => createCounter('')).toThrow('createCounter: name is required')
  })
})
