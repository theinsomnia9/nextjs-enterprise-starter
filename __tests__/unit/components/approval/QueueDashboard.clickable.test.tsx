import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../../setup/test-utils'
import { QueueDashboard } from '@/components/approval/QueueDashboard'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => '/approvals',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/approval/ApprovalPipeline', () => ({
  ApprovalPipeline: ({ counts }: { counts: Record<string, number> }) => (
    <div data-testid="approval-pipeline">
      <span>{counts.PENDING}</span>
    </div>
  ),
}))

const mockCounts = { PENDING: 1, REVIEWING: 1, APPROVED: 0, REJECTED: 0 }

const mockRequests = [
  {
    id: 'req-1',
    title: 'Deploy to production',
    category: 'P1' as const,
    status: 'PENDING' as const,
    priorityScore: 105,
    requester: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    assignee: null,
    lockedAt: null,
    lockExpiresAt: null,
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'req-2',
    title: 'Update dependencies',
    category: 'P3' as const,
    status: 'REVIEWING' as const,
    priorityScore: 52,
    requester: { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
    assignee: { id: 'user-3', name: 'Carol', email: 'carol@example.com' },
    lockedAt: new Date().toISOString(),
    lockExpiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

describe('QueueDashboard — clickable rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('each request row has a data-testid for E2E', () => {
    render(<QueueDashboard requests={mockRequests} counts={mockCounts} currentUserId="user-3" />)
    expect(screen.getByTestId('queue-item-req-1')).toBeDefined()
    expect(screen.getByTestId('queue-item-req-2')).toBeDefined()
  })

  it('clicking a request row navigates to /approvals/[id]', () => {
    render(<QueueDashboard requests={mockRequests} counts={mockCounts} currentUserId="user-3" />)
    fireEvent.click(screen.getByTestId('queue-item-req-1'))
    expect(mockPush).toHaveBeenCalledWith('/approvals/req-1')
  })

  it('clicking a second request row navigates to its own route', () => {
    render(<QueueDashboard requests={mockRequests} counts={mockCounts} currentUserId="user-3" />)
    fireEvent.click(screen.getByTestId('queue-item-req-2'))
    expect(mockPush).toHaveBeenCalledWith('/approvals/req-2')
  })

  it('action buttons (Lock/Approve/Reject/Release) do not navigate when clicked', () => {
    render(
      <QueueDashboard
        requests={mockRequests}
        counts={mockCounts}
        currentUserId="user-3"
        onLock={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    const lockBtn = screen.getAllByRole('button', { name: /lock/i })[0]
    fireEvent.click(lockBtn)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
