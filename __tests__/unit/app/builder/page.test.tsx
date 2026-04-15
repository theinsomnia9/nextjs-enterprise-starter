import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import BuilderPage from '@/app/builder/page'

vi.mock('@/components/workflow/WorkflowBuilder', () => ({
  default: () => <div data-testid="workflow-builder">WorkflowBuilder Mock</div>,
}))

describe('Builder Page', () => {
  it('should render the WorkflowBuilder component', () => {
    render(<BuilderPage />)

    expect(screen.getByTestId('workflow-builder')).toBeInTheDocument()
  })
})
