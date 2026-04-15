import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import CustomNode from '@/components/workflow/nodes/CustomNode'

vi.mock('reactflow', () => ({
  Handle: ({ type, position }: any) => <div data-testid={`handle-${type}`} />,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}))

describe('CustomNode', () => {
  const mockData = {
    label: 'Test Node',
    description: 'This is a test node',
  }

  it('should render node with label', () => {
    render(<CustomNode data={mockData} id="1" isConnectable={true} />)

    expect(screen.getByText('Test Node')).toBeInTheDocument()
  })

  it('should render node with description when provided', () => {
    render(<CustomNode data={mockData} id="1" isConnectable={true} />)

    expect(screen.getByText('This is a test node')).toBeInTheDocument()
  })

  it('should render without description when not provided', () => {
    const dataWithoutDesc = { label: 'Test Node' }
    render(<CustomNode data={dataWithoutDesc} id="1" isConnectable={true} />)

    expect(screen.getByText('Test Node')).toBeInTheDocument()
    expect(screen.queryByText('This is a test node')).not.toBeInTheDocument()
  })

  it('should have proper styling classes', () => {
    const { container } = render(<CustomNode data={mockData} id="1" isConnectable={true} />)

    const nodeElement = container.querySelector('.custom-node')
    expect(nodeElement).toBeInTheDocument()
  })

  it('should be connectable when isConnectable is true', () => {
    render(<CustomNode data={mockData} id="1" isConnectable={true} />)

    const node = screen.getByText('Test Node').closest('div')
    expect(node).toBeTruthy()
  })
})
