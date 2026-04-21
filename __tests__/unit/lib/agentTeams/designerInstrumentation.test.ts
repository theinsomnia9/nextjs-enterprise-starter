import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateSpan, mockHistogramRecord, mockCounterAdd, mockLoggerInfo } = vi.hoisted(() => {
  const mockHistogramRecord = vi.fn()
  const mockCounterAdd = vi.fn()
  const mockLoggerInfo = vi.fn()
  const mockSpan = { setAttribute: vi.fn() }
  const mockCreateSpan = vi.fn(
    (_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) => fn(mockSpan)
  )
  return { mockCreateSpan, mockHistogramRecord, mockCounterAdd, mockLoggerInfo }
})

vi.mock('@/lib/telemetry', () => ({
  createSpan: (...args: Parameters<typeof mockCreateSpan>) => mockCreateSpan(...args),
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  createCounter: vi.fn(() => ({ add: mockCounterAdd })),
  logger: {
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn(async () => ({ rationale: 'ok', ops: [] }))
  return { mockInvoke }
})

const { mockWithStructuredOutput } = vi.hoisted(() => {
  const mockWithStructuredOutput = vi.fn(() => ({ invoke: mockInvoke }))
  return { mockWithStructuredOutput }
})

vi.mock('@/lib/ai', () => ({
  getChatModel: vi.fn(() => ({ withStructuredOutput: mockWithStructuredOutput })),
  chatModelName: vi.fn(() => 'gpt-4o-mini'),
}))

describe('runDesigner instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LLM_PROVIDER = 'openai'
  })

  it('wraps the LLM call in a team.designer.propose span and records llm.call.duration', async () => {
    const { runDesigner } = await import('@/lib/agentTeams/designer')
    await runDesigner({
      message: 'add a researcher',
      current: { version: 1, nodes: [], edges: [], metadata: { title: 'x', description: '' } },
    })
    expect(mockCreateSpan).toHaveBeenCalledWith('team.designer.propose', expect.any(Function))
    expect(mockHistogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        provider: 'openai',
        operation: 'team_designer.propose',
      })
    )
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'llm.call',
      expect.objectContaining({
        provider: 'openai',
        operation: 'team_designer.propose',
      })
    )
  })
})
