import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalService } from '@/services/approvalService'
import type { IApprovalRepository } from '@/lib/approvals/repository'

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

const baseRow = {
  id: 'req-1',
  title: 't',
  description: null,
  category: 'P2' as const,
  status: 'PENDING' as const,
  submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  requesterId: 'u1',
  assigneeId: null,
  approvedById: null,
  lockedAt: null,
  lockExpiresAt: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  requester: { id: 'u1', name: 'Alice', email: 'a@x.com' },
  assignee: null,
}

describe('ApprovalService.getRequestWithScore', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active-queue record with a priorityScore when present', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([baseRow as never])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([
      { category: 'P2', baseWeight: 75, agingFactor: 1.5, slaHours: 48, lockTimeoutMinutes: 5 } as never,
    ])

    const service = new ApprovalService({ repository: repo })
    const result = await service.getRequestWithScore('req-1')

    expect(result.id).toBe('req-1')
    expect(result.priorityScore).toBeGreaterThan(0)
    expect(repo.findById).not.toHaveBeenCalled()
  })

  it('falls back to findById with default config for resolved requests', async () => {
    const resolved = { ...baseRow, id: 'req-2', status: 'APPROVED' as const }
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(repo.findById).mockResolvedValue(resolved as never)

    const service = new ApprovalService({ repository: repo })
    const result = await service.getRequestWithScore('req-2')

    expect(result.id).toBe('req-2')
    expect(result.priorityScore).toBeGreaterThan(0)
  })

  it('throws notFound when no record exists in queue or direct lookup', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findPendingAndReviewingWithAssignee).mockResolvedValue([])
    vi.mocked(repo.getAllPriorityConfigs).mockResolvedValue([])
    vi.mocked(repo.findById).mockResolvedValue(null)

    const service = new ApprovalService({ repository: repo })
    await expect(service.getRequestWithScore('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
