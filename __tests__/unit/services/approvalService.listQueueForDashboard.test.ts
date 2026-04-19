import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalService } from '@/services/approvalService'
import type { IApprovalRepository } from '@/lib/approvals/repository'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRequest: {
      groupBy: vi.fn(),
    },
  },
}))

function makeRequest(overrides: Partial<{ id: string; category: 'P1' | 'P2' | 'P3' | 'P4'; submittedAt: Date; status: string }> = {}) {
  const base = {
    id: overrides.id ?? 'req-1',
    title: 't',
    description: null,
    category: overrides.category ?? 'P1',
    status: overrides.status ?? 'PENDING',
    submittedAt: overrides.submittedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    requesterId: 'user-1',
    assigneeId: null,
    approvedById: null,
    lockedAt: null,
    lockExpiresAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    requester: { id: 'user-1', name: 'Alice', email: 'a@example.com' },
    assignee: null,
  }
  return base
}

function makeRepo(): IApprovalRepository {
  return {
    findById: vi.fn(),
    findPendingAndReviewingWithAssignee: vi.fn(),
    create: vi.fn(),
    lock: vi.fn(),
    release: vi.fn(),
    expireLocks: vi.fn(),
    getAllPriorityConfigs: vi.fn(),
    getPriorityConfig: vi.fn(),
  } as unknown as IApprovalRepository
}

describe('ApprovalService.listQueueForDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns counts by status from groupBy', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(prisma.approvalRequest.groupBy).mockResolvedValue([
      { status: 'PENDING', _count: { id: 3 } },
      { status: 'APPROVED', _count: { id: 5 } },
    ] as never)

    const service = new ApprovalService({ repository: repo })
    const result = await service.listQueueForDashboard()

    expect(result.counts).toEqual({ PENDING: 3, REVIEWING: 0, APPROVED: 5, REJECTED: 0 })
  })

  it('computes priorityScore per request and sorts desc by score', async () => {
    const oldP4 = makeRequest({ id: 'r-old-p4', category: 'P4', submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
    const newP1 = makeRequest({ id: 'r-new-p1', category: 'P1', submittedAt: new Date(Date.now() - 60 * 1000) })

    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([oldP4, newP1] as never)
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([
      { category: 'P1', baseWeight: 100, agingFactor: 2, slaHours: 24, lockTimeoutMinutes: 5 },
      { category: 'P4', baseWeight: 25, agingFactor: 0.5, slaHours: 120, lockTimeoutMinutes: 5 },
    ] as never)
    vi.mocked(prisma.approvalRequest.groupBy).mockResolvedValue([] as never)

    const service = new ApprovalService({ repository: repo })
    const { requests } = await service.listQueueForDashboard()

    expect(requests[0].id).toBe('r-new-p1')
    expect(requests[0].priorityScore).toBeGreaterThan(requests[1].priorityScore)
  })

  it('returns total matching requests length', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([
      makeRequest({ id: 'a' }),
      makeRequest({ id: 'b' }),
    ] as never)
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(prisma.approvalRequest.groupBy).mockResolvedValue([] as never)

    const service = new ApprovalService({ repository: repo })
    const { total } = await service.listQueueForDashboard()
    expect(total).toBe(2)
  })
})
