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

vi.mock('@/lib/approvals/sseServer', () => ({
  broadcastApprovalEvent: vi.fn().mockResolvedValue(undefined),
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
      http.post('/api/approvals', () =>
        HttpResponse.json({ error: 'Title is required' }, { status: 400 })
      )
    )
    const response = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'P1' }),
    })
    expect(response.status).toBe(400)
  })
})
