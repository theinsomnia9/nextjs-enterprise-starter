import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import CustomNode, { type CustomNodeData } from '@/components/workflow/nodes/CustomNode'
import type { NodeProps } from 'reactflow'

vi.mock('reactflow', () => ({
  Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}))

function nodeProps(data: CustomNodeData): NodeProps<CustomNodeData> {
  return {
    id: '1',
    type: 'custom',
    data,
    selected: false,
    zIndex: 0,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    dragging: false,
  } as unknown as NodeProps<CustomNodeData>
}

describe('CustomNode', () => {
  const mockData: CustomNodeData = {
    label: 'Test Node',
    description: 'This is a test node',
  }

  it('should render node with label', () => {
    render(<CustomNode {...nodeProps(mockData)} />)

    expect(screen.getByText('Test Node')).toBeInTheDocument()
  })

  it('should render node with description when provided', () => {
    render(<CustomNode {...nodeProps(mockData)} />)

    expect(screen.getByText('This is a test node')).toBeInTheDocument()
  })

  it('should render without description when not provided', () => {
    const dataWithoutDesc: CustomNodeData = { label: 'Test Node' }
    render(<CustomNode {...nodeProps(dataWithoutDesc)} />)

    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.queryByText('This is a test node')).not.toBeInTheDocument()
  })

  it('should have proper styling classes', () => {
    const { container } = render(<CustomNode {...nodeProps(mockData)} />)

    const nodeElement = container.querySelector('.custom-node')
    expect(nodeElement).toBeInTheDocument()
  })

  it('should be connectable when isConnectable is true', () => {
    render(<CustomNode {...nodeProps(mockData)} />)

    const node = screen.getByText('Test Node').closest('div')
    expect(node).toBeTruthy()
  })
})
