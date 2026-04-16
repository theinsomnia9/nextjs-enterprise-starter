import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('pusher', () => {
  const MockPusher = vi.fn().mockImplementation(() => ({
    trigger: vi.fn().mockResolvedValue({}),
  }))
  return { default: MockPusher }
})

describe('pusherServer', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.PUSHER_APP_ID = 'test-id'
    process.env.PUSHER_APP_KEY = 'test-key'
    process.env.PUSHER_APP_SECRET = 'test-secret'
    process.env.PUSHER_HOST = 'localhost'
    process.env.PUSHER_PORT = '6001'
  })

  it('exports a pusherServer instance', async () => {
    const { pusherServer } = await import('@/lib/approvals/pusherServer')
    expect(pusherServer).toBeDefined()
    expect(typeof pusherServer.trigger).toBe('function')
  })

  it('exports triggerApprovalEvent helper', async () => {
    const { triggerApprovalEvent } = await import('@/lib/approvals/pusherServer')
    expect(typeof triggerApprovalEvent).toBe('function')
  })

  it('triggerApprovalEvent calls trigger on the approval-queue channel', async () => {
    const { pusherServer, triggerApprovalEvent } = await import('@/lib/approvals/pusherServer')
    await triggerApprovalEvent('request:submitted', { requestId: 'abc' })
    expect(pusherServer.trigger).toHaveBeenCalledWith('approval-queue', 'request:submitted', {
      requestId: 'abc',
    })
  })

  it('triggerApprovalEvent resolves without throwing', async () => {
    const { triggerApprovalEvent } = await import('@/lib/approvals/pusherServer')
    await expect(
      triggerApprovalEvent('request:approved', { requestId: 'xyz' })
    ).resolves.not.toThrow()
  })
})
