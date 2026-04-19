import { prisma } from '@/lib/prisma'
import type { ApprovalCategory, ApprovalRequest, PriorityConfig, Prisma } from '@prisma/client'

type UserSelect = { id: string; name: string | null; email: string | null }
type WithRequester = ApprovalRequest & { requester: UserSelect }
type WithRequesterAndAssignee = WithRequester & { assignee: UserSelect | null }

export interface IApprovalRepository {
  findById(id: string): Promise<WithRequesterAndAssignee | null>
  findPendingAndReviewingWithAssignee(): Promise<WithRequesterAndAssignee[]>
  create(data: Prisma.ApprovalRequestCreateInput): Promise<WithRequester>
  lock(id: string, reviewerId: string, lockExpiresAt: Date): Promise<WithRequesterAndAssignee>
  release(id: string): Promise<WithRequester>
  expireLocks(before: Date): Promise<{ count: number; ids: string[] }>
  getAllPriorityConfigs(): Promise<PriorityConfig[]>
  getPriorityConfig(category: ApprovalCategory): Promise<PriorityConfig | null>
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
}

export const approvalRepository = new ApprovalRepository()
