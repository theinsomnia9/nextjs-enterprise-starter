import { IApprovalRepository, approvalRepository } from '@/lib/approvals/repository'
import { notFound, alreadyResolved, lockedByOther, notCurrentReviewer, validationError } from '@/lib/errors/AppError'
import { type PriorityConfigValues } from '@/lib/approvals/types'
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
    const [{ requests, configs }, statusCounts] = await Promise.all([
      this.getQueueWithConfigs(),
      this.repo.getStatusCounts(),
    ])

    const counts = {
      PENDING: statusCounts.PENDING,
      REVIEWING: statusCounts.REVIEWING,
      APPROVED: statusCounts.APPROVED,
      REJECTED: statusCounts.REJECTED,
    }

    const scored = requests
      .map((r) => ({ ...r, priorityScore: calculatePriorityScore(r.submittedAt, r.config) }))
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return { requests: scored, total: scored.length, counts, configs }
  }

  async getRequestWithScore(id: string) {
    const request = await this.getRequest(id)
    const config = await this.getPriorityConfig(request.category)
    return {
      ...request,
      priorityScore: calculatePriorityScore(request.submittedAt, config),
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
    const result = await this.repo.tryLock(id, reviewerId)
    if (result.ok) return result.row
    switch (result.reason) {
      case 'not_found':
        throw notFound('Request', id)
      case 'already_resolved':
        throw alreadyResolved()
      case 'locked_by_other':
        throw lockedByOther(result.lockedByName ?? result.lockedById ?? undefined)
    }
  }

  async release(id: string, reviewerId: string) {
    const existing = await this.repo.findById(id)
    if (!existing) throw notFound('Request', id)
    if (existing.assigneeId !== reviewerId) throw notCurrentReviewer()
    return this.repo.release(id)
  }

  async approve(id: string, approverId: string) {
    const result = await this.repo.tryApprove(id, approverId)
    if (result.ok) return result.row
    switch (result.reason) {
      case 'not_found':
        throw notFound('Request', id)
      case 'already_resolved':
        throw alreadyResolved()
      case 'locked_by_other':
        throw lockedByOther()
    }
  }

  async reject(id: string, rejectorId: string, reason: string) {
    const result = await this.repo.tryReject(id, rejectorId, reason)
    if (result.ok) return result.row
    switch (result.reason) {
      case 'not_found':
        throw notFound('Request', id)
      case 'already_resolved':
        throw alreadyResolved()
      case 'locked_by_other':
        throw lockedByOther()
    }
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
