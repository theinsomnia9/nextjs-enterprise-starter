import { describe, it, expect } from 'vitest'
import { render, screen } from '../../setup/test-utils'
import Home from '@/app/page'

describe('Home Page', () => {
  it('should render the workspace heading', () => {
    render(<Home />)

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument()
  })

  it('should render a subtitle describing purpose', () => {
    render(<Home />)

    expect(screen.getByText(/jump into a tool/i)).toBeInTheDocument()
  })

  it('should expose a primary navigation landmark', () => {
    render(<Home />)

    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
  })

  it('should have a link to the Agent Team Builder page', () => {
    render(<Home />)

    const card = screen.getByTestId('nav-card-agent-teams')
    const link = card.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/agent-teams')
  })

  it('should have a link to the Chat page', () => {
    render(<Home />)

    const card = screen.getByTestId('nav-card-chat')
    const link = card.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/chat')
  })

  it('should have a link to the Approval Queue page', () => {
    render(<Home />)

    const card = screen.getByTestId('nav-card-approvals')
    const link = card.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/approvals')
  })

  it('should render exactly the three primary nav cards', () => {
    render(<Home />)

    expect(screen.getByTestId('nav-card-agent-teams')).toBeInTheDocument()
    expect(screen.getByTestId('nav-card-chat')).toBeInTheDocument()
    expect(screen.getByTestId('nav-card-approvals')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-card-builder')).not.toBeInTheDocument()
  })
})
