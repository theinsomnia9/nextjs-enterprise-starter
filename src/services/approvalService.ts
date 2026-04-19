import { prisma } from '@/lib/prisma'
import { IApprovalRepository, approvalRepository } from '@/lib/approvals/repository'
import { notFound, alreadyResolved, lockedByOther, notCurrentReviewer, validationError } from '@/lib/errors/AppError'
import type { PriorityConfigValues } from '@/lib/approvals/types'
import type { Prisma } from '@prisma/client'
import { calculatePriorityScore } from '@/lib/approvals/priorityScore'

export interface ApprovalServiceDeps {
  repository: IApprovalRepository
}

const DEFAULT_PRIORITY_CONFIG: PriorityConfigValues = {
  baseWeight: 25,
  agingFactor: 0.5,
  slaHours: 120,
  lockTimeoutMinutes: 5,
}

export class ApprovalService {
  private readonly repo: IApprovalRepository

  constructor(deps: ApprovalServiceDeps = { repository: approvalRepository }) {
    this.repo = deps.repository
  }

  async getRequest(id: string) {
    const request = await this.repo.findById(id)
    if (!request) throw notFound('Request', id)
    return request
  }

  async getQueueWithConfigs() {
    const [requests, configs] = await Promise.all([
      this.repo.findPendingAndReviewingWithAssignee(),
      this.repo.getAllPriorityConfigs(),
    ])

    const configMap = new Map(
      configs.map((c) => [
        c.category,
        {
          baseWeight: c.baseWeight,
          agingFactor: c.agingFactor,
          slaHours: c.slaHours,
          lockTimeoutMinutes: c.lockTimeoutMinutes,
        } as PriorityConfigValues,
      ])
    )

    const requestsWithConfig = requests.map((r) => ({
      ...r,
      config: configMap.get(r.category) ?? DEFAULT_PRIORITY_CONFIG,
    }))

    return { requests: requestsWithConfig, configs }
  }

  async listQueueForDashboard() {
    const [{ requests, configs }, statusGroups] = await Promise.all([
      this.getQueueWithConfigs(),
      prisma.approvalRequest.groupBy({ by: ['status'], _count: { id: true } }),
    ])

    const counts: Record<'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED', number> = {
      PENDING: 0,
      REVIEWING: 0,
      APPROVED: 0,
      REJECTED: 0,
    }
    for (const g of statusGroups) {
      if (g.status in counts) counts[g.status as keyof typeof counts] = g._count.id
    }

    const scored = requests
      .map((r) => ({ ...r, priorityScore: calculatePriorityScore(r.submittedAt, r.config) }))
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return { requests: scored, total: scored.length, counts, configs }
  }

  async getRequestWithScore(id: string) {
    const { requests, configs } = await this.getQueueWithConfigs()
    const queued = requests.find((r) => r.id === id)
    if (queued) {
      return {
        ...queued,
        priorityScore: calculatePriorityScore(queued.submittedAt, queued.config),
      }
    }

    const request = await this.getRequest(id)
    const configMap = new Map<string, PriorityConfigValues>(
      configs.map((c) => [c.category as string, c as PriorityConfigValues])
    )
    const fallbackConfig = configMap.get(request.category) ?? DEFAULT_PRIORITY_CONFIG
    return {
      ...request,
      priorityScore: calculatePriorityScore(request.submittedAt, fallbackConfig),
    }
  }

  async createApproval(data: Prisma.ApprovalRequestCreateInput) {
    try {
      return await this.repo.create(data)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'P2003' || code === 'P2025') {
        const requesterId =
          (data.requester as { connect?: { id?: string } } | undefined)?.connect?.id ?? 'unknown'
        throw validationError(
          `requesterId "${requesterId}" does not exist. Use a seeded dev user id (e.g. dev-user-alice).`
        )
      }
      throw err
    }
  }

  async lock(id: string, reviewerId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, lockExpiresAt: true, assigneeId: true, category: true },
      })

      if (!existing) throw notFound('Request', id)
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED') throw alreadyResolved()

      const lockActive =
        existing.lockExpiresAt &&
        existing.lockExpiresAt > new Date() &&
        existing.assigneeId !== reviewerId

      if (lockActive) {
        const lockedByUser = await tx.user
          .findUnique({ where: { id: existing.assigneeId! }, select: { name: true } })
          .catch(() => null)
        throw lockedByOther(lockedByUser?.name ?? existing.assigneeId ?? undefined)
      }

      const config = await tx.priorityConfig.findUnique({ where: { category: existing.category } })
      const lockExpiresAt = new Date(Date.now() + (config?.lockTimeoutMinutes ?? 5) * 60 * 1000)

      return tx.approvalRequest.update({
        where: { id },
        data: { assigneeId: reviewerId, status: 'REVIEWING', lockedAt: new Date(), lockExpiresAt },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      })
    })
  }

  async release(id: string, reviewerId: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw notFound('Request', id)
    if (existing.assigneeId !== reviewerId) throw notCurrentReviewer()
    return this.repo.release(id)
  }

  async approve(id: string, approverId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, assigneeId: true },
      })

      if (!existing) throw notFound('Request', id)
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED') throw alreadyResolved()
      if (existing.assigneeId && existing.assigneeId !== approverId) throw lockedByOther()

      return tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: approverId,
          approvedAt: new Date(),
          assigneeId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      })
    })
  }

  async reject(id: string, rejectorId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, assigneeId: true },
      })

      if (!existing) throw notFound('Request', id)
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED') throw alreadyResolved()
      if (existing.assigneeId && existing.assigneeId !== rejectorId) throw lockedByOther()

      return tx.approvalRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedAt: new Date(),
          assigneeId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true } },
        },
      })
    })
  }

  async getPriorityConfig(category: string): Promise<PriorityConfigValues> {
    const config = await this.repo.getPriorityConfig(category as never)
    if (!config) return DEFAULT_PRIORITY_CONFIG
    return {
      baseWeight: config.baseWeight,
      agingFactor: config.agingFactor,
      slaHours: config.slaHours,
      lockTimeoutMinutes: config.lockTimeoutMinutes,
    }
  }

  async expireLocks() {
    return this.repo.expireLocks(new Date())
  }
}

export const approvalService = new ApprovalService()
