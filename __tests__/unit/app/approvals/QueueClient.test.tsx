import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueueClient } from '@/app/(protected)/approvals/_components/QueueClient'
import type { QueueRequest } from '@/components/approval/QueueDashboard'

vi.mock('@/app/(protected)/approvals/actions', () => ({
  lockAction: vi.fn(),
  releaseAction: vi.fn(),
  approveAction: vi.fn(),
  rejectAction: vi.fn(),
}))

const { lockAction, approveAction } = await import('@/app/(protected)/approvals/actions')

function makeRequest(overrides: Partial<QueueRequest> = {}): QueueRequest {
  return {
    id: 'r1',
    title: 'Test',
    category: 'P1',
    status: 'PENDING',
    priorityScore: 100,
    requester: { id: 'u1', name: 'Alice', email: 'a@x.com' },
    assignee: null,
    lockedAt: null,
    lockExpiresAt: null,
    submittedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('QueueClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies optimistic lock and calls lockAction', async () => {
    vi.mocked(lockAction).mockResolvedValue({ ok: true, data: {} as never })
    render(
      <QueueClient
        initialRequests={[makeRequest()]}
        initialCounts={{ PENDING: 1, REVIEWING: 0, APPROVED: 0, REJECTED: 0 }}
        currentUserId="u1"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /lock/i }))
    expect(lockAction).toHaveBeenCalledWith('r1')
  })

  it('removes a request from the list after successful approve', async () => {
    vi.mocked(approveAction).mockResolvedValue({ ok: true, data: {} as never })
    render(
      <QueueClient
        initialRequests={[makeRequest({ status: 'REVIEWING', assignee: { id: 'u1', name: 'Me', email: null }, lockExpiresAt: new Date(Date.now() + 60000).toISOString() })]}
        initialCounts={{ PENDING: 0, REVIEWING: 1, APPROVED: 0, REJECTED: 0 }}
        currentUserId="u1"
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(approveAction).toHaveBeenCalledWith('r1')
  })
})
