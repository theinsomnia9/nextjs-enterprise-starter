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

describe('ApprovalService.lock', () => {
  let repo: IApprovalRepository

  beforeEach(() => {
    repo = makeRepo()
  })

  it('delegates the transaction to repo.tryLock and returns its row on success', async () => {
    const row = {
      id: 'req-1',
      status: 'REVIEWING',
      assigneeId: 'user-1',
      lockExpiresAt: new Date(),
      requester: { id: 'r', name: null, email: null },
      assignee: { id: 'user-1', name: null, email: null },
    }
    vi.mocked(repo.tryLock).mockResolvedValue({ ok: true, row: row as never })

    const svc = new ApprovalService({ repository: repo })
    const result = await svc.lock('req-1', 'user-1')

    expect(repo.tryLock).toHaveBeenCalledWith('req-1', 'user-1')
    expect(repo.lock).not.toHaveBeenCalled()
    expect(result.status).toBe('REVIEWING')
  })

  it('throws notFound when repo reports not_found', async () => {
    vi.mocked(repo.tryLock).mockResolvedValue({ ok: false, reason: 'not_found' })
    const svc = new ApprovalService({ repository: repo })
    await expect(svc.lock('missing', 'user-1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws alreadyResolved when repo reports already_resolved', async () => {
    vi.mocked(repo.tryLock).mockResolvedValue({ ok: false, reason: 'already_resolved' })
    const svc = new ApprovalService({ repository: repo })
    await expect(svc.lock('req-1', 'user-1')).rejects.toMatchObject({ code: 'ALREADY_RESOLVED' })
  })

  it('throws lockedByOther with the name when repo reports locked_by_other', async () => {
    vi.mocked(repo.tryLock).mockResolvedValue({
      ok: false,
      reason: 'locked_by_other',
      lockedByName: 'Bob',
      lockedById: 'user-2',
    })
    const svc = new ApprovalService({ repository: repo })
    await expect(svc.lock('req-1', 'user-1')).rejects.toMatchObject({
      code: 'LOCKED_BY_OTHER',
      details: { lockedBy: 'Bob' },
    })
  })
})
