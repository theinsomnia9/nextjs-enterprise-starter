import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCounterAdd, mockHistogramRecord, mockSetAttribute, mockLoggerInfo, mockLoggerError, mockCreateSpan } = vi.hoisted(() => {
  const mockCounterAdd = vi.fn()
  const mockHistogramRecord = vi.fn()
  const mockSetAttribute = vi.fn()
  const mockLoggerInfo = vi.fn()
  const mockLoggerError = vi.fn()
  const mockSpan = { setAttribute: mockSetAttribute, end: vi.fn() }
  const mockCreateSpan = vi.fn((_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) =>
    fn(mockSpan)
  )
  return { mockCounterAdd, mockHistogramRecord, mockSetAttribute, mockLoggerInfo, mockLoggerError, mockCreateSpan }
})

vi.mock('@/lib/telemetry', () => ({
  createSpan: (...args: Parameters<typeof mockCreateSpan>) => mockCreateSpan(...args),
  createCounter: vi.fn((name: string) =>
    name === 'agent_team.run.total'
      ? { add: (n: number, attrs: Record<string, string>) => mockCounterAdd('total', n, attrs) }
      : { add: (n: number, attrs: Record<string, string>) => mockCounterAdd('events', n, attrs) }
  ),
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  logger: {
    debug: vi.fn(),
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    warn: vi.fn(),
    error: (...a: unknown[]) => mockLoggerError(...a),
  },
  addSpanEvent: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: vi.fn(async () => ({ id: 'user-1' })) }))

vi.mock('@/services/agentTeamService', () => ({
  agentTeamService: {
    get: vi.fn(async () => ({
      id: 'team-1',
      definition: { version: 1, nodes: [{ id: 'a' }, { id: 'b' }], edges: [], metadata: {} },
    })),
  },
}))

vi.mock('@/lib/agentTeams/executor', () => ({
  executeTeam: vi.fn(async function* () {
    yield { type: 'run_started', teamId: 'team-1' }
    yield { type: 'node_started', nodeId: 'a', label: 'A', kind: 'agent' }
    yield { type: 'node_completed', nodeId: 'a', outputPreview: 'ok' }
    yield { type: 'final', output: 'done' }
  }),
}))

vi.mock('@/lib/api/withApi', () => ({
  withApi: (_name: string, fn: unknown) => fn,
}))

describe('POST /api/agent-teams/[id]/run instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits a team.run span, increments run.events.total per event, and records duration on success', async () => {
    const { POST } = await import('@/app/api/agent-teams/[id]/run/route')
    const req = new Request('http://localhost/api/agent-teams/team-1/run', {
      method: 'POST',
      body: JSON.stringify({ input: 'hi' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await (POST as (r: Request, ctx: unknown) => Promise<Response>)(req, {
      params: Promise.resolve({ id: 'team-1' }),
    })
    const reader = res.body!.getReader()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(mockCreateSpan).toHaveBeenCalledWith('team.run', expect.any(Function))
    expect(mockSetAttribute).toHaveBeenCalledWith('team.id', 'team-1')
    expect(mockSetAttribute).toHaveBeenCalledWith('user.id', 'user-1')
    expect(mockSetAttribute).toHaveBeenCalledWith('node_count', 2)
    expect(mockSetAttribute).toHaveBeenCalledWith('run.status', 'completed')

    expect(mockCounterAdd).toHaveBeenCalledWith(
      'total',
      1,
      expect.objectContaining({ result: 'ok' })
    )
    const eventCalls = mockCounterAdd.mock.calls.filter((c) => c[0] === 'events')
    expect(eventCalls).toHaveLength(4)
    expect(mockHistogramRecord).toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith('agent_team.run.start', expect.any(Object))
    expect(mockLoggerInfo).toHaveBeenCalledWith('agent_team.run.end', expect.any(Object))
  })
})
