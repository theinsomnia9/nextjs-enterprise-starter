import { describe, it, expect, vi } from 'vitest'
import { ApprovalService } from '@/services/approvalService'
import { AppError, ErrorCode } from '@/lib/errors/AppError'
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
  } as unknown as IApprovalRepository
}

describe('ApprovalService.createApproval', () => {
  it('translates P2003 into a VALIDATION_ERROR AppError', async () => {
    const repo = makeRepo()
    ;(repo.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('fk constraint'), { code: 'P2003' })
    )
    const svc = new ApprovalService({ repository: repo })

    await expect(
      svc.createApproval({
        title: 't',
        category: 'P1',
        requester: { connect: { id: 'missing-user' } },
      })
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === ErrorCode.VALIDATION_ERROR
    })
  })

  it('translates P2025 into a VALIDATION_ERROR AppError', async () => {
    const repo = makeRepo()
    ;(repo.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('record not found'), { code: 'P2025' })
    )
    const svc = new ApprovalService({ repository: repo })

    await expect(
      svc.createApproval({
        title: 't',
        category: 'P1',
        requester: { connect: { id: 'missing-user' } },
      })
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === ErrorCode.VALIDATION_ERROR
    })
  })

  it('rethrows unknown errors unchanged', async () => {
    const repo = makeRepo()
    const boom = new Error('boom')
    ;(repo.create as ReturnType<typeof vi.fn>).mockRejectedValue(boom)
    const svc = new ApprovalService({ repository: repo })

    await expect(
      svc.createApproval({
        title: 't',
        category: 'P1',
        requester: { connect: { id: 'u' } },
      })
    ).rejects.toBe(boom)
  })
})
