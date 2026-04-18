import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
  },
}))

vi.mock('@/lib/approvals/sseServer', () => ({
  triggerApprovalEvent: vi.fn().mockResolvedValue(undefined),
}))

describe('GET /api/cron/expire-locks', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('returns 401 without Authorization header', async () => {
    const { GET } = await import('@/app/api/cron/expire-locks/route')
    const req = new Request('http://localhost/api/cron/expire-locks')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const { GET } = await import('@/app/api/cron/expire-locks/route')
    const req = new Request('http://localhost/api/cron/expire-locks', {
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with count of expired locks released', async () => {
    const { GET } = await import('@/app/api/cron/expire-locks/route')
    const req = new Request('http://localhost/api/cron/expire-locks', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('released')
    expect(typeof body.released).toBe('number')
  })

  it('resets status to PENDING and clears lock fields on expired locks', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/cron/expire-locks/route')
    const req = new Request('http://localhost/api/cron/expire-locks', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(prisma.approvalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'REVIEWING' }),
        data: expect.objectContaining({ status: 'PENDING', assigneeId: null }),
      })
    )
  })

  it('triggers queue:counts SSE event after release', async () => {
    const { triggerApprovalEvent } = await import('@/lib/approvals/sseServer')
    const { GET } = await import('@/app/api/cron/expire-locks/route')
    const req = new Request('http://localhost/api/cron/expire-locks', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(triggerApprovalEvent).toHaveBeenCalledWith('queue:counts', expect.any(Object))
  })
})
