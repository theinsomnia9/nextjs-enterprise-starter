import { agentTeamRepository, type IAgentTeamRepository } from '@/lib/agentTeams/repository'
import { notFound, validationError, forbidden } from '@/lib/errors/AppError'
import { emptyDefinition, validateTeamDefinition } from '@/lib/agentTeams/validator'
import type { AgentTeamDetail, TeamDefinition } from '@/lib/agentTeams/types'

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
    await this.get(id, ownerId)
    if (patch.definition) {
      const report = validateTeamDefinition(patch.definition)
      if (!report.ok) {
        throw validationError('Team definition is invalid', { issues: report.issues })
      }
    }
    return this.repo.update(id, patch)
  }

  async delete(id: string, ownerId: string): Promise<void> {
    await this.get(id, ownerId)
    await this.repo.delete(id)
  }
}

export const agentTeamService = new AgentTeamService()
