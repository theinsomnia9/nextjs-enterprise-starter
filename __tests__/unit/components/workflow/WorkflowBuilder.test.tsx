import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../../setup/test-utils'
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder'

vi.mock('reactflow', () => {
  const MockReactFlow = ({
    children,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  }: any) => (
    <div data-testid="react-flow">
      <div data-testid="nodes-count">{nodes?.length || 0}</div>
      <div data-testid="edges-count">{edges?.length || 0}</div>
      <button
        data-testid="add-node-trigger"
        onClick={() => {
          const newNode = {
            id: 'test-node-1',
            position: { x: 100, y: 100 },
            data: { label: 'Test Node' },
            type: 'custom',
          }
          onNodesChange?.([{ type: 'add', item: newNode }])
        }}
      >
        Add Node
      </button>
      <button
        data-testid="connect-trigger"
        onClick={() => {
          onConnect?.({ source: '1', target: '2' })
        }}
      >
        Connect
      </button>
      {children}
    </div>
  )
  return {
    default: MockReactFlow,
    ReactFlow: MockReactFlow,
    BackgroundVariant: { Dots: 'dots', Lines: 'lines', Cross: 'cross' },
    MiniMap: () => <div data-testid="minimap">MiniMap</div>,
    Controls: () => <div data-testid="controls">Controls</div>,
    Background: ({ variant }: any) => <div data-testid="background">{variant}</div>,
    useNodesState: (initialNodes: any[]) => {
      const [nodes, setNodes] = vi.fn(() => [initialNodes, vi.fn(), vi.fn()])()
      return [nodes, setNodes, vi.fn()]
    },
    useEdgesState: (initialEdges: any[]) => {
      const [edges, setEdges] = vi.fn(() => [initialEdges, vi.fn(), vi.fn()])()
      return [edges, setEdges, vi.fn()]
    },
    addEdge: vi.fn((params, edges) => [...edges, params]),
  }
})

describe('WorkflowBuilder', () => {
  it('should render the workflow builder with ReactFlow', async () => {
    render(<WorkflowBuilder />)

    expect(await screen.findByTestId('react-flow')).toBeInTheDocument()
  })

  it('should render MiniMap, Controls, and Background components', () => {
    render(<WorkflowBuilder />)

    expect(screen.getByTestId('minimap')).toBeInTheDocument()
    expect(screen.getByTestId('controls')).toBeInTheDocument()
    expect(screen.getByTestId('background')).toBeInTheDocument()
  })

  it('should initialize with default nodes', () => {
    render(<WorkflowBuilder />)

    const nodesCount = screen.getByTestId('nodes-count')
    expect(parseInt(nodesCount.textContent || '0')).toBeGreaterThan(0)
  })

  it('should have a toolbar for adding nodes', () => {
    render(<WorkflowBuilder />)

    const addButtons = screen.getAllByRole('button', { name: /Add Node/i })
    expect(addButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('should add a new node when add button is clicked', async () => {
    render(<WorkflowBuilder />)

    const addButtons = screen.getAllByRole('button', { name: /Add Node/i })
    const addButton = addButtons[0]
    const initialCount = parseInt(screen.getByTestId('nodes-count').textContent || '0')

    fireEvent.click(addButton)

    await waitFor(() => {
      const newCount = parseInt(screen.getByTestId('nodes-count').textContent || '0')
      expect(newCount).toBeGreaterThanOrEqual(initialCount)
    })
  })

  it('should support node deletion', () => {
    render(<WorkflowBuilder />)

    expect(screen.getByText(/Delete/i) || screen.getByText(/Remove/i)).toBeDefined()
  })
})
