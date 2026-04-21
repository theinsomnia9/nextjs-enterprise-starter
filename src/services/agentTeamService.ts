import { agentTeamRepository, type IAgentTeamRepository } from '@/lib/agentTeams/repository'
import { notFound, validationError, forbidden, AppError } from '@/lib/errors/AppError'
import { emptyDefinition, validateTeamDefinition } from '@/lib/agentTeams/validator'
import type { AgentTeamDetail, TeamDefinition } from '@/lib/agentTeams/types'
import { createSpan, createCounter, createHistogram, logger } from '@/lib/telemetry'

const saveTotal = createCounter('agent_team.save.total', {
  description: 'Agent team save operations, labeled by result.',
  unit: '1',
})

const saveDuration = createHistogram('agent_team.save.duration', {
  description: 'Duration of agent team save operations.',
  unit: 'ms',
})

type SaveResult = 'ok' | 'validation_error' | 'forbidden' | 'not_found' | 'error'

function classifyError(err: unknown): SaveResult {
  if (err instanceof AppError) {
    if (err.code === 'NOT_FOUND') return 'not_found'
    if (err.code === 'FORBIDDEN') return 'forbidden'
    if (err.code === 'VALIDATION_ERROR') return 'validation_error'
  }
  return 'error'
}

export interface AgentTeamServiceDeps {
  repository: IAgentTeamRepository
}

export class AgentTeamService {
  private readonly repo: IAgentTeamRepository

  constructor(deps: AgentTeamServiceDeps = { repository: agentTeamRepository }) {
    this.repo = deps.repository
  }

  async list(ownerId: string) {
    return this.repo.list(ownerId)
  }

  async get(id: string, ownerId: string): Promise<AgentTeamDetail> {
    const team = await this.repo.findById(id)
    if (!team) throw notFound('AgentTeam', id)
    if (team.createdById !== ownerId) throw forbidden(['owner'])
    return team
  }

  async create(input: {
    name: string
    description?: string | null
    definition?: TeamDefinition
    createdById: string
  }): Promise<AgentTeamDetail> {
    const definition = input.definition ?? emptyDefinition(input.name)
    const report = validateTeamDefinition(definition)
    if (!report.ok) {
      throw validationError('Team definition is invalid', { issues: report.issues })
    }
    return this.repo.create({
      name: input.name,
      description: input.description ?? null,
      definition,
      createdById: input.createdById,
    })
  }

  async update(
    id: string,
    ownerId: string,
    patch: {
      name?: string
      description?: string | null
      definition?: TeamDefinition
      isActive?: boolean
    }
  ): Promise<AgentTeamDetail> {
    return createSpan('team.update', async (span) => {
      const startedAt = performance.now()
      let result: SaveResult = 'ok'
      try {
        await this.get(id, ownerId)
        const changedFields = Object.keys(patch).filter(
          (k) => (patch as Record<string, unknown>)[k] !== undefined
        )
        span.setAttribute('team.id', id)
        span.setAttribute('user.id', ownerId)
        span.setAttribute('changed_fields', changedFields.join(','))

        if (patch.definition) {
          const report = validateTeamDefinition(patch.definition)
          if (!report.ok) {
            result = 'validation_error'
            logger.warn('agent_team.save', {
              teamId: id,
              result,
              issueCount: report.issues.length,
            })
            throw validationError('Team definition is invalid', { issues: report.issues })
          }
        }

        const updated = await this.repo.update(id, patch)
        logger.info('agent_team.save', {
          teamId: id,
          changedFields: changedFields.join(','),
          result,
        })
        return updated
      } catch (err) {
        if (result === 'ok') result = classifyError(err)
        if (result === 'error') {
          logger.error('agent_team.save failed', err as Error, { teamId: id })
        }
        throw err
      } finally {
        const durationMs = performance.now() - startedAt
        saveTotal.add(1, { result })
        saveDuration.record(durationMs, { result })
      }
    })
  }

  async delete(id: string, ownerId: string): Promise<void> {
    await this.get(id, ownerId)
    await this.repo.delete(id)
  }
}

export const agentTeamService = new AgentTeamService()
