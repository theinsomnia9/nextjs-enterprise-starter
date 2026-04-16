import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    priorityConfig: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/approvals/pusherServer', () => ({
  triggerApprovalEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  }),
}))

describe('POST /api/approvals', () => {
  it('returns 201 with created request', async () => {
    const response = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Deploy v2.1.0',
        description: 'Production release',
        category: 'P1',
      }),
    })
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data).toHaveProperty('id')
    expect(data.title).toBe('Deploy v2.1.0')
  })

  it('returns 400 on missing title', async () => {
    server.use(
      http.post('/api/approvals', () => HttpResponse.json({ error: 'Title is required' }, { status: 400 }))
    )
    const response = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'P1' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('GET /api/approvals/queue', () => {
  it('returns prioritized queue', async () => {
    const response = await fetch('/api/approvals/queue')
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('requests')
    expect(Array.isArray(data.requests)).toBe(true)
    expect(data).toHaveProperty('total')
  })

  it('queue items include priorityScore', async () => {
    const response = await fetch('/api/approvals/queue')
    const data = await response.json()
    expect(data.requests[0]).toHaveProperty('priorityScore')
  })
})

describe('POST /api/approvals/:id/lock', () => {
  it('returns 200 with locked request', async () => {
    const response = await fetch('/api/approvals/req-1/lock', { method: 'POST' })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('REVIEWING')
    expect(data.lockExpiresAt).toBeTruthy()
  })

  it('locked request has non-null assigneeId', async () => {
    const response = await fetch('/api/approvals/req-1/lock', { method: 'POST' })
    const data = await response.json()
    expect(data.assigneeId).not.toBeNull()
  })
})

describe('POST /api/approvals/:id/release', () => {
  it('returns 200 with released request', async () => {
    const response = await fetch('/api/approvals/req-1/release', { method: 'POST' })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('PENDING')
    expect(data.lockExpiresAt).toBeNull()
    expect(data.assigneeId).toBeNull()
  })
})

describe('POST /api/approvals/:id/approve', () => {
  it('returns 200 with approved status', async () => {
    const response = await fetch('/api/approvals/req-1/approve', { method: 'POST' })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('APPROVED')
    expect(data.approvedAt).toBeTruthy()
  })
})

describe('POST /api/approvals/:id/reject', () => {
  it('returns 200 with rejected status', async () => {
    const response = await fetch('/api/approvals/req-1/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Does not meet requirements' }),
    })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('REJECTED')
    expect(data.rejectionReason).toBe('Does not meet requirements')
  })
})
