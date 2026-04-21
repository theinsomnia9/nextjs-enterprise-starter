import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentTeamService } from '@/services/agentTeamService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import type { IAgentTeamRepository } from '@/lib/agentTeams/repository'
import type { AgentTeamDetail, TeamDefinition } from '@/lib/agentTeams/types'
import { emptyDefinition } from '@/lib/agentTeams/validator'

const {
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockCounterAdd,
  mockHistogramRecord,
  mockCreateSpan,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockCounterAdd: vi.fn(),
  mockHistogramRecord: vi.fn(),
  mockCreateSpan: vi.fn((_name: string, fn: (span: unknown) => Promise<unknown>) =>
    fn({ setAttribute: vi.fn() })
  ),
}))

vi.mock('@/lib/telemetry', () => ({
  logger: {
    debug: vi.fn(),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
  createCounter: vi.fn(() => ({ add: mockCounterAdd })),
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  createSpan: (...args: Parameters<typeof mockCreateSpan>) => mockCreateSpan(...args),
  addSpanAttribute: vi.fn(),
}))

function makeRepo(): IAgentTeamRepository {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as IAgentTeamRepository
}

function makeDetail(overrides: Partial<AgentTeamDetail> = {}): AgentTeamDetail {
  return {
    id: 't1',
    name: 'Test',
    description: null,
    isActive: true,
    updatedAt: new Date(),
    createdAt: new Date(),
    createdById: 'owner-1',
    definition: emptyDefinition('Test'),
    ...overrides,
  }
}

describe('AgentTeamService.get', () => {
  it('throws NOT_FOUND when the repo returns null', async () => {
    const repo = makeRepo()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new AgentTeamService({ repository: repo })
    await expect(svc.get('missing', 'owner')).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === ErrorCode.NOT_FOUND
    )
  })

  it('throws FORBIDDEN when the requester is not the owner', async () => {
    const repo = makeRepo()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDetail({ createdById: 'other' })
    )
    const svc = new AgentTeamService({ repository: repo })
    await expect(svc.get('t1', 'me')).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === ErrorCode.FORBIDDEN
    )
  })

  it('returns the team for the owner', async () => {
    const repo = makeRepo()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail())
    const svc = new AgentTeamService({ repository: repo })
    const team = await svc.get('t1', 'owner-1')
    expect(team.id).toBe('t1')
  })
})

describe('AgentTeamService.create', () => {
  it('uses emptyDefinition when no definition is provided', async () => {
    const repo = makeRepo()
    const spy = repo.create as ReturnType<typeof vi.fn>
    spy.mockResolvedValue(makeDetail())
    const svc = new AgentTeamService({ repository: repo })
    await svc.create({ name: 'My Team', createdById: 'owner-1' })
    expect(spy).toHaveBeenCalled()
    const args = spy.mock.calls[0][0] as { definition: TeamDefinition }
    expect(args.definition.metadata.title).toBe('My Team')
    expect(args.definition.nodes.some((n) => n.type === 'trigger')).toBe(true)
  })

  it('throws VALIDATION_ERROR for an invalid graph', async () => {
    const repo = makeRepo()
    const svc = new AgentTeamService({ repository: repo })
    const invalid: TeamDefinition = {
      version: 1,
      nodes: [],
      edges: [],
      metadata: { title: 'Broken' },
    }
    await expect(
      svc.create({ name: 'Broken', definition: invalid, createdById: 'owner-1' })
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === ErrorCode.VALIDATION_ERROR
    )
  })
})

describe('AgentTeamService.update', () => {
  it('enforces owner check before updating', async () => {
    const repo = makeRepo()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDetail({ createdById: 'other' })
    )
    const svc = new AgentTeamService({ repository: repo })
    await expect(svc.update('t1', 'me', { name: 'X' })).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === ErrorCode.FORBIDDEN
    )
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('validates the new definition when one is supplied', async () => {
    const repo = makeRepo()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail())
    const svc = new AgentTeamService({ repository: repo })
    const invalid: TeamDefinition = {
      version: 1,
      nodes: [],
      edges: [],
      metadata: { title: 'x' },
    }
    await expect(
      svc.update('t1', 'owner-1', { definition: invalid })
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === ErrorCode.VALIDATION_ERROR
    )
  })
})

describe('AgentTeamService.delete', () => {
  it('enforces owner check', async () => {
    const repo = makeRepo()
    ;(repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDetail({ createdById: 'other' })
    )
    const svc = new AgentTeamService({ repository: repo })
    await expect(svc.delete('t1', 'me')).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && e.code === ErrorCode.FORBIDDEN
    )
  })
})

// ---------------------------------------------------------------------------
// Telemetry tests
// ---------------------------------------------------------------------------

const minimalDefinition: TeamDefinition = {
  version: 1,
  nodes: [{ id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: { kind: 'trigger', label: 'Trigger' } }],
  edges: [],
  metadata: { title: 'T', description: '' },
}

const baseTeam: AgentTeamDetail = {
  id: 'team-1',
  name: 'Team One',
  description: null,
  isActive: true,
  createdById: 'user-1',
  definition: minimalDefinition,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeTelemetryRepo(overrides: Partial<IAgentTeamRepository> = {}): IAgentTeamRepository {
  return {
    list: vi.fn(async () => []),
    findById: vi.fn(async () => baseTeam),
    create: vi.fn(async () => baseTeam),
    update: vi.fn(async (_id, patch) => ({ ...baseTeam, ...patch })),
    delete: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('AgentTeamService.update telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits save.total=ok and save.duration on success', async () => {
    const svc = new AgentTeamService({ repository: makeTelemetryRepo() })
    await svc.update('team-1', 'user-1', { name: 'renamed' })
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'ok' }))
    expect(mockHistogramRecord).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ result: 'ok' })
    )
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'agent_team.save',
      expect.objectContaining({ teamId: 'team-1', result: 'ok' })
    )
  })

  it('wraps the call in a createSpan("team.update")', async () => {
    const svc = new AgentTeamService({ repository: makeTelemetryRepo() })
    await svc.update('team-1', 'user-1', { name: 'x' })
    expect(mockCreateSpan).toHaveBeenCalledWith('team.update', expect.any(Function))
  })

  it('emits result=forbidden when caller is not the owner', async () => {
    const svc = new AgentTeamService({
      repository: makeTelemetryRepo({ findById: vi.fn(async () => ({ ...baseTeam, createdById: 'someone-else' })) }),
    })
    await expect(svc.update('team-1', 'user-1', { name: 'x' })).rejects.toThrow()
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'forbidden' }))
  })

  it('emits result=not_found when team missing', async () => {
    const svc = new AgentTeamService({
      repository: makeTelemetryRepo({ findById: vi.fn(async () => null) }),
    })
    await expect(svc.update('team-1', 'user-1', { name: 'x' })).rejects.toThrow()
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'not_found' }))
  })

  it('emits result=validation_error when definition is invalid', async () => {
    const badDefinition = { version: 1, nodes: [], edges: [], metadata: { title: '' } } as unknown as TeamDefinition
    const svc = new AgentTeamService({ repository: makeTelemetryRepo() })
    await expect(
      svc.update('team-1', 'user-1', { definition: badDefinition })
    ).rejects.toThrow()
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'validation_error' }))
    expect(mockLoggerWarn).toHaveBeenCalled()
  })

  it('emits result=error on unexpected repo failure', async () => {
    const svc = new AgentTeamService({
      repository: makeTelemetryRepo({ update: vi.fn(async () => { throw new Error('db boom') }) }),
    })
    await expect(svc.update('team-1', 'user-1', { name: 'x' })).rejects.toThrow('db boom')
    expect(mockCounterAdd).toHaveBeenCalledWith(1, expect.objectContaining({ result: 'error' }))
    expect(mockLoggerError).toHaveBeenCalledWith(
      'agent_team.save failed',
      expect.any(Error),
      expect.objectContaining({ teamId: 'team-1' })
    )
  })
})
