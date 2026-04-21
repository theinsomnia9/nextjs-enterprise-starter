import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import '../../helpers/mockActor'
import { setActor, clearActor } from '../../helpers/mockActor'
import { spyOnBroadcast } from '../../helpers/broadcastSpy'
import { prisma } from '@/lib/prisma'
import { lockAction, releaseAction, approveAction, rejectAction } from '@/app/(protected)/approvals/actions'

const TEST_USER = { id: 'int-user-alice', email: 'int-alice@example.com', name: 'Int Alice' }
const OTHER_USER = { id: 'int-user-bob', email: 'int-bob@example.com', name: 'Int Bob' }

async function seedRequest(overrides: Partial<{ status: string; assigneeId: string | null; lockExpiresAt: Date | null }> = {}) {
  return prisma.approvalRequest.create({
    data: {
      title: 'Integration Test Request',
      category: 'P2',
      status: (overrides.status as never) ?? 'PENDING',
      submittedAt: new Date(),
      requester: { connect: { id: TEST_USER.id } },
      ...(overrides.assigneeId && {
        assignee: { connect: { id: overrides.assigneeId } },
      }),
      lockExpiresAt: overrides.lockExpiresAt ?? null,
    },
  })
}

describe('approvals Server Actions (integration)', () => {
  let broadcastSpy: ReturnType<typeof spyOnBroadcast>

  beforeAll(async () => {
    await prisma.user.upsert({ where: { id: TEST_USER.id }, create: TEST_USER, update: {} })
    await prisma.user.upsert({ where: { id: OTHER_USER.id }, create: OTHER_USER, update: {} })
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    broadcastSpy = spyOnBroadcast()
    await setActor(TEST_USER.id)
    await prisma.approvalRequest.deleteMany({ where: { requesterId: TEST_USER.id } })
  })

  afterAll(async () => {
    await prisma.approvalRequest.deleteMany({ where: { requesterId: TEST_USER.id } })
    await prisma.user.deleteMany({ where: { id: { in: [TEST_USER.id, OTHER_USER.id] } } })
  })

  describe('lockAction', () => {
    it('locks a PENDING request and broadcasts request:locked', async () => {
      const req = await seedRequest()
      const result = await lockAction(req.id)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('REVIEWING')
      expect(result.data.assigneeId).toBe(TEST_USER.id)
      expect(broadcastSpy).toHaveBeenCalledWith('request:locked', expect.objectContaining({ requestId: req.id, reviewerId: TEST_USER.id }))
    })

    it('returns LOCKED_BY_OTHER when another reviewer holds an active lock', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: OTHER_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await lockAction(req.id)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('LOCKED_BY_OTHER')
    })

    it('returns NOT_FOUND for an unknown id', async () => {
      const result = await lockAction('nonexistent-id')
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('NOT_FOUND')
    })
  })

  describe('releaseAction', () => {
    it('releases a lock held by the current actor', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await releaseAction(req.id)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('PENDING')
      expect(broadcastSpy).toHaveBeenCalledWith('request:unlocked', expect.objectContaining({ requestId: req.id }))
    })

    it('rejects a release attempt by a non-reviewer', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: OTHER_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await releaseAction(req.id)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('approveAction', () => {
    it('approves a REVIEWING request held by the actor', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const result = await approveAction(req.id)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('APPROVED')
      expect(broadcastSpy).toHaveBeenCalledWith('request:approved', { requestId: req.id })
    })

    it('rejects an already-resolved request', async () => {
      const req = await seedRequest({ status: 'APPROVED' })
      const result = await approveAction(req.id)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('ALREADY_RESOLVED')
    })
  })

  describe('rejectAction', () => {
    it('rejects a request with a reason', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const fd = new FormData()
      fd.set('reason', 'Missing context')
      const result = await rejectAction(req.id, fd)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.status).toBe('REJECTED')
      expect(result.data.rejectionReason).toBe('Missing context')
      expect(broadcastSpy).toHaveBeenCalledWith(
        'request:rejected',
        expect.objectContaining({ requestId: req.id, reason: 'Missing context' })
      )
    })

    it('returns VALIDATION when reason is empty', async () => {
      const req = await seedRequest({
        status: 'REVIEWING',
        assigneeId: TEST_USER.id,
        lockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      const fd = new FormData()
      fd.set('reason', '')
      const result = await rejectAction(req.id, fd)
      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected not ok')
      expect(result.error.code).toBe('VALIDATION')
      expect(result.error.fields?.reason).toBe('Rejection reason is required')
    })
  })
})

describe('approvals authz matrix', () => {
  beforeAll(async () => {
    await prisma.user.upsert({ where: { id: TEST_USER.id }, create: TEST_USER, update: {} })
  })

  it('approveAction: Requester role → FORBIDDEN', async () => {
    const req = await seedRequest()
    await setActor(TEST_USER.id, ['Requester'])
    const result = await approveAction(req.id)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error.code).toBe('FORBIDDEN')
  })

  it('approveAction: Approver role → succeeds (no role error)', async () => {
    const req = await seedRequest()
    await setActor(TEST_USER.id, ['Approver'])
    // Lock first so approve can proceed per service rules
    const locked = await lockAction(req.id)
    expect(locked.ok).toBe(true)
    const result = await approveAction(req.id)
    expect(result.ok).toBe(true)
  })

  it('approveAction: Admin role → succeeds (no role error)', async () => {
    const req = await seedRequest()
    await setActor(TEST_USER.id, ['Admin'])
    const locked = await lockAction(req.id)
    expect(locked.ok).toBe(true)
    const result = await approveAction(req.id)
    expect(result.ok).toBe(true)
  })

  it('approveAction: no session → UNAUTHORIZED', async () => {
    const req = await seedRequest()
    await clearActor()
    const result = await approveAction(req.id)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.error.code).toBe('UNAUTHORIZED')
  })
})
