import { prisma } from '@/lib/prisma'
import type { ApprovalCategory, ApprovalRequest, ApprovalStatus as PrismaApprovalStatus, PriorityConfig, Prisma } from '@/generated/prisma/client'

type UserSelect = { id: string; name: string | null; email: string | null }
type WithRequester = ApprovalRequest & { requester: UserSelect }
type WithRequesterAndAssignee = WithRequester & { assignee: UserSelect | null }

// Queue-dashboard shape excludes large TEXT fields not needed for the list view.
export type QueueRow = Omit<ApprovalRequest, 'description' | 'rejectionReason'> & {
  requester: UserSelect
  assignee: UserSelect | null
}

export type LockResult =
  | { ok: true; row: WithRequesterAndAssignee }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_resolved' }
  | { ok: false; reason: 'locked_by_other'; lockedByName: string | null; lockedById: string | null }

export type ResolveResult =
  | { ok: true; row: WithRequesterAndAssignee }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_resolved' }
  | { ok: false; reason: 'locked_by_other' }

export interface IApprovalRepository {
  findById(id: string): Promise<WithRequesterAndAssignee | null>
  findPendingAndReviewingWithAssignee(): Promise<QueueRow[]>
  create(data: Prisma.ApprovalRequestCreateInput): Promise<WithRequester>
  lock(id: string, reviewerId: string, lockExpiresAt: Date): Promise<WithRequesterAndAssignee>
  release(id: string): Promise<WithRequester>
  expireLocks(before: Date): Promise<{ count: number; ids: string[] }>
  getAllPriorityConfigs(): Promise<PriorityConfig[]>
  getPriorityConfig(category: ApprovalCategory): Promise<PriorityConfig | null>
  getStatusCounts(): Promise<Record<PrismaApprovalStatus, number>>
  tryLock(id: string, reviewerId: string): Promise<LockResult>
  tryApprove(id: string, approverId: string): Promise<ResolveResult>
  tryReject(id: string, rejectorId: string, reason: string): Promise<ResolveResult>
}

const userSelect = { select: { id: true, name: true, email: true } } as const

export class ApprovalRepository implements IApprovalRepository {
  async findById(id: string) {
    return prisma.approvalRequest.findUnique({
      where: { id },
      include: { requester: userSelect, assignee: userSelect },
    })
  }

  async findPendingAndReviewingWithAssignee() {
    // Exclude large TEXT fields (description, rejectionReason) not used by the
    // queue dashboard — they bloat payloads in long queues.
    return prisma.approvalRequest.findMany({
      where: { status: { in: ['PENDING', 'REVIEWING'] } },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        requesterId: true,
        assigneeId: true,
        lockedAt: true,
        lockExpiresAt: true,
        approvedById: true,
        approvedAt: true,
        rejectedAt: true,
        submittedAt: true,
        updatedAt: true,
        requester: userSelect,
        assignee: userSelect,
      },
      orderBy: { submittedAt: 'asc' },
    })
  }

  async create(data: Prisma.ApprovalRequestCreateInput) {
    return prisma.approvalRequest.create({
      data,
      include: { requester: userSelect },
    })
  }

  async lock(id: string, reviewerId: string, lockExpiresAt: Date) {
    return prisma.approvalRequest.update({
      where: { id },
      data: { assigneeId: reviewerId, status: 'REVIEWING', lockedAt: new Date(), lockExpiresAt },
      include: { requester: userSelect, assignee: userSelect },
    })
  }

  async release(id: string) {
    return prisma.approvalRequest.update({
      where: { id },
      data: { assigneeId: null, status: 'PENDING', lockedAt: null, lockExpiresAt: null },
      include: { requester: userSelect },
    })
  }

  async expireLocks(before: Date) {
    const toExpire = await prisma.approvalRequest.findMany({
      where: { status: 'REVIEWING', lockExpiresAt: { lt: before } },
      select: { id: true },
    })

    if (toExpire.length === 0) return { count: 0, ids: [] }

    const ids = toExpire.map((r) => r.id)
    await prisma.approvalRequest.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PENDING', assigneeId: null, lockedAt: null, lockExpiresAt: null },
    })

    return { count: toExpire.length, ids }
  }

  async getAllPriorityConfigs() {
    return prisma.priorityConfig.findMany()
  }

  async getPriorityConfig(category: ApprovalCategory) {
    return prisma.priorityConfig.findUnique({ where: { category } })
  }

  async getStatusCounts(): Promise<Record<PrismaApprovalStatus, number>> {
    const groups = await prisma.approvalRequest.groupBy({ by: ['status'], _count: { id: true } })
    const counts: Record<PrismaApprovalStatus, number> = {
      PENDING: 0,
      REVIEWING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    }
    for (const g of groups) counts[g.status] = g._count.id
    return counts
  }

  async tryLock(id: string, reviewerId: string): Promise<LockResult> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, lockExpiresAt: true, assigneeId: true, category: true },
      })

      if (!existing) return { ok: false, reason: 'not_found' }
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED')
        return { ok: false, reason: 'already_resolved' }

      const lockActive =
        existing.lockExpiresAt &&
        existing.lockExpiresAt > new Date() &&
        existing.assigneeId !== reviewerId

      if (lockActive) {
        const lockedByUser = await tx.user
          .findUnique({ where: { id: existing.assigneeId! }, select: { name: true } })
          .catch(() => null)
        return {
          ok: false,
          reason: 'locked_by_other',
          lockedByName: lockedByUser?.name ?? null,
          lockedById: existing.assigneeId ?? null,
        }
      }

      const config = await tx.priorityConfig.findUnique({ where: { category: existing.category } })
      const lockExpiresAt = new Date(Date.now() + (config?.lockTimeoutMinutes ?? 5) * 60 * 1000)

      const row = await tx.approvalRequest.update({
        where: { id },
        data: { assigneeId: reviewerId, status: 'REVIEWING', lockedAt: new Date(), lockExpiresAt },
        include: {
          requester: userSelect,
          assignee: userSelect,
        },
      })
      return { ok: true, row }
    })
  }

  async tryApprove(id: string, approverId: string): Promise<ResolveResult> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, assigneeId: true },
      })

      if (!existing) return { ok: false, reason: 'not_found' }
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED')
        return { ok: false, reason: 'already_resolved' }
      if (existing.assigneeId && existing.assigneeId !== approverId)
        return { ok: false, reason: 'locked_by_other' }

      const row = await tx.approvalRequest.update({
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
          requester: userSelect,
          assignee: userSelect,
        },
      })
      return { ok: true, row }
    })
  }

  async tryReject(id: string, rejectorId: string, reason: string): Promise<ResolveResult> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id },
        select: { status: true, assigneeId: true },
      })

      if (!existing) return { ok: false, reason: 'not_found' }
      if (existing.status === 'APPROVED' || existing.status === 'REJECTED')
        return { ok: false, reason: 'already_resolved' }
      if (existing.assigneeId && existing.assigneeId !== rejectorId)
        return { ok: false, reason: 'locked_by_other' }

      const row = await tx.approvalRequest.update({
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
          requester: userSelect,
          assignee: userSelect,
        },
      })
      return { ok: true, row }
    })
  }
}

export const approvalRepository = new ApprovalRepository()
