import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../../setup/test-utils'
import { ApprovalFlowDiagram } from '@/components/approval/ApprovalFlowDiagram'
import { createYjsRoom } from '@/lib/approvals/yjsClient'

vi.mock('reactflow', async () => {
  const React = await import('react')
  const MockFlow = ({
    children,
    onNodeClick,
    onNodeDragStop,
    nodes,
  }: {
    children?: React.ReactNode
    onNodeClick?: (
      event: React.MouseEvent,
      node: { id: string; data: unknown; position: { x: number; y: number } }
    ) => void
    onNodeDragStop?: (
      event: React.MouseEvent,
      node: { id: string; data: unknown; position: { x: number; y: number } }
    ) => void
    nodes?: Array<{ id: string; data: unknown; position: { x: number; y: number } }>
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'react-flow' },
      nodes?.map((n) =>
        React.createElement(
          'div',
          {
            key: n.id,
            'data-testid': `node-${n.id}`,
            onClick: (e: React.MouseEvent) => onNodeClick?.(e, n),
            onMouseUp: (e: React.MouseEvent) => onNodeDragStop?.(e, n),
          },
          String(n.id)
        )
      ),
      children
    )
  return {
    default: MockFlow,
    Background: () => React.createElement('div', { 'data-testid': 'background' }),
    Controls: () => React.createElement('div', { 'data-testid': 'controls' }),
    MiniMap: () => React.createElement('div', { 'data-testid': 'minimap' }),
    Handle: ({ type }: { type: string }) =>
      React.createElement('div', { 'data-testid': `handle-${type}` }),
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
    BackgroundVariant: { Dots: 'dots' },
    useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  }
})

function makeYjsMapMock() {
  const store = new Map<string, unknown>()
  return {
    get: (key: string) => store.get(key),
    set: (key: string, val: unknown) => store.set(key, val),
    observe: vi.fn(),
    unobserve: vi.fn(),
  }
}

vi.mock('@/lib/approvals/yjsClient', () => ({
  createYjsRoom: vi.fn().mockImplementation(() => ({
    doc: {},
    nodesMap: makeYjsMapMock(),
    edgesMap: makeYjsMapMock(),
    awareness: {
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getStates: vi.fn().mockReturnValue(new Map()),
    },
    provider: { disconnect: vi.fn(), destroy: vi.fn() },
  })),
  destroyYjsRoom: vi.fn(),
}))

const mockRequest = {
  id: 'req-abc',
  title: 'Update Node.js to v22 LTS',
  category: 'P3',
  status: 'REVIEWING',
  priorityScore: 50,
  requester: { id: 'user-1', name: 'Bob', email: 'bob@example.com' },
  assignee: { id: 'user-2', name: 'Alice', email: 'alice@example.com' },
  lockedAt: new Date().toISOString(),
  lockExpiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
  submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
}

describe('ApprovalFlowDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the flow diagram container', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('approval-flow-diagram')).toBeDefined()
  })

  it('renders the ReactFlow canvas', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('react-flow')).toBeDefined()
  })

  it('renders at least 3 nodes', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    const nodes = screen.getAllByTestId(/^node-/)
    expect(nodes.length).toBeGreaterThanOrEqual(3)
  })

  it('renders Submit node', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('node-submit')).toBeDefined()
  })

  it('renders Review node', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('node-review')).toBeDefined()
  })

  it('renders Decision node', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('node-decision')).toBeDefined()
  })

  it('shows detail panel when a node is clicked', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    fireEvent.click(screen.getByTestId('node-submit'))
    expect(screen.getByTestId('node-detail-panel')).toBeDefined()
  })

  it('detail panel can be dismissed', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    fireEvent.click(screen.getByTestId('node-submit'))
    expect(screen.getByTestId('node-detail-panel')).toBeDefined()
    fireEvent.click(screen.getByTestId('detail-panel-close'))
    expect(screen.queryByTestId('node-detail-panel')).toBeNull()
  })

  it('displays requester name in submit node detail', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    fireEvent.click(screen.getByTestId('node-submit'))
    expect(screen.getByTestId('node-detail-panel')).toBeDefined()
    expect(screen.getByText(/Bob/)).toBeDefined()
  })

  it('renders controls', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('controls')).toBeDefined()
  })

  it('renders background', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    expect(screen.getByTestId('background')).toBeDefined()
  })

  it('accepts an optional roomId prop', () => {
    render(<ApprovalFlowDiagram request={mockRequest} roomId="custom-room" />)
    expect(screen.getByTestId('approval-flow-diagram')).toBeDefined()
  })

  it('nodes are draggable (onMouseUp fires without error)', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    const submitNode = screen.getByTestId('node-submit')
    expect(submitNode).toBeDefined()
    expect(() => fireEvent.mouseUp(submitNode)).not.toThrow()
  })

  it('broadcasts position to Yjs on node drag stop', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    const reviewNode = screen.getByTestId('node-review')
    fireEvent.mouseUp(reviewNode)
    const room = (createYjsRoom as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(room).toBeDefined()
    expect(room.nodesMap.get('review')).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    })
  })

  it('clicking same node twice deselects it', () => {
    render(<ApprovalFlowDiagram request={mockRequest} />)
    fireEvent.click(screen.getByTestId('node-submit'))
    expect(screen.getByTestId('node-detail-panel')).toBeDefined()
    fireEvent.click(screen.getByTestId('node-submit'))
    expect(screen.queryByTestId('node-detail-panel')).toBeNull()
  })
})
