import { describe, it, expect } from 'vitest'
import { render, screen } from '../../setup/test-utils'
import Home from '@/app/page'

describe('Home Page', () => {
  it('should render the dev navigation heading', () => {
    render(<Home />)

    expect(screen.getByText('Dev Navigation')).toBeInTheDocument()
  })

  it('should render a subtitle describing purpose', () => {
    render(<Home />)

    expect(screen.getByText(/navigate across features/i)).toBeInTheDocument()
  })

  it('should have a link to the Chat page', () => {
    render(<Home />)

    const link = screen.getByRole('link', { name: /chat/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/chat')
  })

  it('should have a link to the Workflow Builder page', () => {
    render(<Home />)

    const link = screen.getByRole('link', { name: /workflow builder/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/builder')
  })

  it('should have a link to the Approvals page', () => {
    render(<Home />)

    const link = screen.getByRole('link', { name: /approvals/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/approvals')
  })

  it('should render a nav card for each feature with a description', () => {
    render(<Home />)

    expect(screen.getByTestId('nav-card-chat')).toBeInTheDocument()
    expect(screen.getByTestId('nav-card-builder')).toBeInTheDocument()
    expect(screen.getByTestId('nav-card-approvals')).toBeInTheDocument()
  })
})
