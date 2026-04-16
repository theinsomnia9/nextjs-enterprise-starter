import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { QueueDashboard } from '@/components/approval/QueueDashboard'

vi.mock('@/components/approval/ApprovalPipeline', () => ({
  ApprovalPipeline: ({ initialCounts }: { initialCounts: Record<string, number> }) => (
    <div data-testid="approval-pipeline">
      <span>{initialCounts.PENDING}</span>
    </div>
  ),
}))

const mockRequests = [
  {
    id: 'req-1',
    title: 'Deploy to production',
    category: 'P1',
    status: 'PENDING',
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
    category: 'P3',
    status: 'REVIEWING',
    priorityScore: 52,
    requester: { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
    assignee: { id: 'user-3', name: 'Carol', email: 'carol@example.com' },
    lockedAt: new Date().toISOString(),
    lockExpiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

describe('QueueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dashboard container', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByTestId('queue-dashboard')).toBeDefined()
  })

  it('renders the ApprovalPipeline component', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByTestId('approval-pipeline')).toBeDefined()
  })

  it('renders all request titles', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByText('Deploy to production')).toBeDefined()
    expect(screen.getByText('Update dependencies')).toBeDefined()
  })

  it('renders category badges', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByText('P1')).toBeDefined()
    expect(screen.getByText('P3')).toBeDefined()
  })

  it('renders priority score for each request', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByText(/105/)).toBeDefined()
    expect(screen.getByText(/52/)).toBeDefined()
  })

  it('shows lock indicator for REVIEWING requests', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByTestId('lock-indicator-req-2')).toBeDefined()
  })

  it('does not show lock indicator for PENDING requests', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.queryByTestId('lock-indicator-req-1')).toBeNull()
  })

  it('shows a Lock button for PENDING requests', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    const lockBtns = screen.getAllByRole('button', { name: /lock/i })
    expect(lockBtns.length).toBeGreaterThan(0)
  })

  it('shows Release button for requests locked by currentUser', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByRole('button', { name: /release/i })).toBeDefined()
  })

  it('renders requester name for each request', () => {
    render(<QueueDashboard requests={mockRequests} currentUserId="user-3" />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })
})
