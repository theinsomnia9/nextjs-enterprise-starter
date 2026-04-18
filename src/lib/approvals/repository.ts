import { prisma } from '@/lib/prisma'
import type { ApprovalRequest, PriorityConfig, Prisma } from '@prisma/client'

type UserSelect = { id: string; name: string | null; email: string | null }
type WithRequester = ApprovalRequest & { requester: UserSelect }
type WithRequesterAndAssignee = WithRequester & { assignee: UserSelect | null }
type WithRequesterAndApprovedBy = WithRequester & { approvedBy: UserSelect | null }

export interface IApprovalRepository {
  findById(id: string): Promise<WithRequesterAndAssignee | null>
  findPendingAndReviewingWithAssignee(): Promise<WithRequesterAndAssignee[]>
  create(data: Prisma.ApprovalRequestCreateInput): Promise<WithRequester>
  lock(id: string, reviewerId: string, lockExpiresAt: Date): Promise<WithRequesterAndAssignee>
  release(id: string): Promise<WithRequester>
  approve(id: string, approverId: string): Promise<WithRequesterAndApprovedBy>
  reject(id: string, rejectorId: string, reason: string): Promise<WithRequester>
  expireLocks(before: Date): Promise<{ count: number; ids: string[] }>
  getAllPriorityConfigs(): Promise<PriorityConfig[]>
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
    return prisma.approvalRequest.findMany({
      where: { status: { in: ['PENDING', 'REVIEWING'] } },
      include: { requester: userSelect, assignee: userSelect },
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

  async approve(id: string, approverId: string) {
    return prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
        assigneeId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
      include: { requester: userSelect, approvedBy: userSelect },
    })
  }

  async reject(id: string, _rejectorId: string, reason: string) {
    return prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
        assigneeId: null,
        lockedAt: null,
        lockExpiresAt: null,
      },
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
}

export const approvalRepository = new ApprovalRepository()
