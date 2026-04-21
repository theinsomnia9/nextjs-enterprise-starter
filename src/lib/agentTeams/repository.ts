import { prisma } from '@/lib/prisma'
import type { Prisma, Workflow } from '@/generated/prisma/client'
import type { AgentTeamDetail, AgentTeamSummary, TeamDefinition } from './types'

export interface IAgentTeamRepository {
  list(ownerId: string): Promise<AgentTeamSummary[]>
  findById(id: string): Promise<AgentTeamDetail | null>
  create(input: {
    name: string
    description?: string | null
    definition: TeamDefinition
    createdById: string
  }): Promise<AgentTeamDetail>
  update(
    id: string,
    patch: {
      name?: string
      description?: string | null
      definition?: TeamDefinition
      isActive?: boolean
    }
  ): Promise<AgentTeamDetail>
  delete(id: string): Promise<void>
}

function toSummary(row: Pick<Workflow, 'id' | 'name' | 'description' | 'isActive' | 'updatedAt' | 'createdAt' | 'createdById'>): AgentTeamSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    createdById: row.createdById,
  }
}

function toDetail(row: Workflow): AgentTeamDetail {
  return {
    ...toSummary(row),
    definition: row.definition as unknown as TeamDefinition,
  }
}

export class AgentTeamRepository implements IAgentTeamRepository {
  async list(ownerId: string) {
    const rows = await prisma.workflow.findMany({
      where: { createdById: ownerId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        updatedAt: true,
        createdAt: true,
        createdById: true,
      },
    })
    return rows.map(toSummary)
  }

  async findById(id: string) {
    const row = await prisma.workflow.findUnique({ where: { id } })
    if (!row) return null
    return toDetail(row)
  }

  async create(input: {
    name: string
    description?: string | null
    definition: TeamDefinition
    createdById: string
  }) {
    const row = await prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        definition: input.definition as unknown as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    })
    return toDetail(row)
  }

  async update(
    id: string,
    patch: {
      name?: string
      description?: string | null
      definition?: TeamDefinition
      isActive?: boolean
    }
  ) {
    const data: Prisma.WorkflowUpdateInput = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.description !== undefined) data.description = patch.description
    if (patch.isActive !== undefined) data.isActive = patch.isActive
    if (patch.definition !== undefined) {
      data.definition = patch.definition as unknown as Prisma.InputJsonValue
    }

    const row = await prisma.workflow.update({ where: { id }, data })
    return toDetail(row)
  }

  async delete(id: string) {
    await prisma.workflow.delete({ where: { id } })
  }
}

export const agentTeamRepository = new AgentTeamRepository()
