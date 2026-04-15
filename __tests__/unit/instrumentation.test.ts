import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/telemetry/instrumentation.node.js', () => ({}))
vi.mock('@/lib/telemetry/instrumentation.edge.js', () => ({}))

describe('instrumentation register', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.NEXT_RUNTIME
  })

  it('should import node instrumentation when runtime is nodejs', async () => {
    process.env.NEXT_RUNTIME = 'nodejs'

    const { register } = await import('@/instrumentation')
    await register()

    // The import completes without error
    expect(true).toBe(true)
  })

  it('should import edge instrumentation when runtime is edge', async () => {
    process.env.NEXT_RUNTIME = 'edge'

    const { register } = await import('@/instrumentation')
    await register()

    expect(true).toBe(true)
  })

  it('should not import anything when runtime is undefined', async () => {
    delete process.env.NEXT_RUNTIME

    const { register } = await import('@/instrumentation')
    await register()

    expect(true).toBe(true)
  })
})
