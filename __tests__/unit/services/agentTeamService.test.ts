import { describe, it, expect, vi } from 'vitest'
import { AgentTeamService } from '@/services/agentTeamService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
import type { IAgentTeamRepository } from '@/lib/agentTeams/repository'
import type { AgentTeamDetail, TeamDefinition } from '@/lib/agentTeams/types'
import { emptyDefinition } from '@/lib/agentTeams/validator'

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
