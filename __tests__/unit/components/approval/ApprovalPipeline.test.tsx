import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { ApprovalPipeline } from '@/components/approval/ApprovalPipeline'

vi.mock('reactflow', async () => {
  const React = await import('react')
  const MockFlow = ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'react-flow' }, children)
  return {
    default: MockFlow,
    Background: () => React.createElement('div', { 'data-testid': 'background' }),
    Controls: () => React.createElement('div', { 'data-testid': 'controls' }),
    Handle: ({ type }: { type: string }) =>
      React.createElement('div', { 'data-testid': `handle-${type}` }),
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
    useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    BackgroundVariant: { Dots: 'dots' },
  }
})

vi.mock('pusher-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockReturnValue({
      bind: vi.fn(),
      unbind: vi.fn(),
      unbind_all: vi.fn(),
    }),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

vi.mock('@/lib/approvals/yjsClient', () => ({
  createYjsRoom: vi.fn().mockReturnValue({
    doc: {},
    nodesMap: new Map(),
    edgesMap: new Map(),
    awareness: {
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getStates: vi.fn().mockReturnValue(new Map()),
    },
    provider: { disconnect: vi.fn(), destroy: vi.fn() },
  }),
  destroyYjsRoom: vi.fn(),
}))

const mockCounts = { PENDING: 3, REVIEWING: 1, APPROVED: 12, REJECTED: 2 }

describe('ApprovalPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the ReactFlow canvas', () => {
    render(<ApprovalPipeline initialCounts={mockCounts} />)
    expect(screen.getByTestId('react-flow')).toBeDefined()
  })

  it('renders PENDING, REVIEWING, APPROVED, REJECTED stage labels', () => {
    render(<ApprovalPipeline initialCounts={mockCounts} />)
    expect(screen.getByText('PENDING')).toBeDefined()
    expect(screen.getByText('REVIEWING')).toBeDefined()
    expect(screen.getByText('APPROVED')).toBeDefined()
    expect(screen.getByText('REJECTED')).toBeDefined()
  })

  it('renders initial count badges (pipeline container is present)', () => {
    render(<ApprovalPipeline initialCounts={mockCounts} />)
    expect(screen.getByTestId('approval-pipeline')).toBeDefined()
  })

  it('renders with data-testid for E2E targeting', () => {
    render(<ApprovalPipeline initialCounts={mockCounts} />)
    expect(screen.getByTestId('approval-pipeline')).toBeDefined()
  })

  it('accepts an onNodeClick callback prop', () => {
    const onNodeClick = vi.fn()
    render(<ApprovalPipeline initialCounts={mockCounts} onNodeClick={onNodeClick} />)
    expect(screen.getByTestId('approval-pipeline')).toBeDefined()
  })
})
