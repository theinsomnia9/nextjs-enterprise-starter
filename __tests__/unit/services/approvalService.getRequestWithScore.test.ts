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
    getStatusCounts: vi.fn(),
    tryLock: vi.fn(),
    tryApprove: vi.fn(),
    tryReject: vi.fn(),
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

  it('returns the request with a priorityScore from the matching category config', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findById).mockResolvedValue(baseRow as never)
    vi.mocked(repo.getPriorityConfig).mockResolvedValue({
      category: 'P2', baseWeight: 75, agingFactor: 1.5, slaHours: 48, lockTimeoutMinutes: 5,
    } as never)

    const service = new ApprovalService({ repository: repo })
    const result = await service.getRequestWithScore('req-1')

    expect(result.id).toBe('req-1')
    expect(result.priorityScore).toBeGreaterThan(0)
    expect(repo.getPriorityConfig).toHaveBeenCalledWith('P2')
  })

  it('uses default config when no category-specific config exists', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findById).mockResolvedValue(baseRow as never)
    vi.mocked(repo.getPriorityConfig).mockResolvedValue(null)

    const service = new ApprovalService({ repository: repo })
    const result = await service.getRequestWithScore('req-1')

    expect(result.id).toBe('req-1')
    expect(result.priorityScore).toBeGreaterThan(0)
  })

  it('throws notFound when the request does not exist', async () => {
    const repo = makeRepo()
    vi.mocked(repo.findById).mockResolvedValue(null)

    const service = new ApprovalService({ repository: repo })
    await expect(service.getRequestWithScore('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
