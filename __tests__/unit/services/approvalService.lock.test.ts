import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalService } from '@/services/approvalService'
import type { IApprovalRepository } from '@/lib/approvals/repository'

vi.mock('@/lib/prisma', () => {
  const txCalls: string[] = []
  const tx = {
    approvalRequest: {
      findUnique: vi.fn().mockResolvedValue({
        status: 'PENDING',
        lockExpiresAt: null,
        assigneeId: null,
        category: 'P2',
      }),
      update: vi.fn().mockImplementation(async (args: unknown) => {
        txCalls.push('tx.update')
        return {
          id: (args as { where: { id: string } }).where.id,
          assigneeId: 'user-1',
          status: 'REVIEWING',
          lockExpiresAt: new Date(),
          requester: { id: 'r', name: null, email: null },
          assignee: { id: 'user-1', name: null, email: null },
        }
      }),
    },
    priorityConfig: {
      findUnique: vi.fn().mockResolvedValue({ lockTimeoutMinutes: 5 }),
    },
    user: { findUnique: vi.fn() },
  }
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __txCalls: txCalls,
    },
  }
})

describe('ApprovalService.lock', () => {
  let repoSpy: IApprovalRepository

  beforeEach(() => {
    repoSpy = {
      findById: vi.fn(),
      findPendingAndReviewingWithAssignee: vi.fn(),
      create: vi.fn(),
      lock: vi.fn(), // MUST NOT BE CALLED after the fix
      release: vi.fn(),
      expireLocks: vi.fn(),
      getAllPriorityConfigs: vi.fn(),
      getPriorityConfig: vi.fn(),
    } as unknown as IApprovalRepository
  })

  it('performs the lock update INSIDE the transaction (not via repo.lock)', async () => {
    const svc = new ApprovalService({ repository: repoSpy })
    const result = await svc.lock('req-1', 'user-1')

    // The repo.lock path is the bug — it must not be used anymore.
    expect(repoSpy.lock).not.toHaveBeenCalled()
    expect(result.status).toBe('REVIEWING')
    expect(result.assigneeId).toBe('user-1')
  })
})
