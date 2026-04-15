import { describe, it, expect } from 'vitest'
import { render, screen } from '../../setup/test-utils'
import Home from '@/app/page'

describe('Home Page', () => {
  it('should render the main heading', () => {
    render(<Home />)

    expect(screen.getByText('Enterprise Boilerplate')).toBeInTheDocument()
  })

  it('should display feature list items', () => {
    render(<Home />)

    expect(screen.getByText(/Microsoft Entra ID Authentication/)).toBeInTheDocument()
    expect(screen.getByText(/OpenTelemetry Observability/)).toBeInTheDocument()
    expect(screen.getByText(/Real-time Chat/)).toBeInTheDocument()
    expect(screen.getByText(/Visual Workflow Builder/)).toBeInTheDocument()
    expect(screen.getByText(/PostgreSQL with Prisma ORM/)).toBeInTheDocument()
    expect(screen.getByText(/Comprehensive Testing/)).toBeInTheDocument()
    expect(screen.getByText(/Test-Driven Development/)).toBeInTheDocument()
  })

  it('should have a link to the workflow builder', () => {
    render(<Home />)

    const link = screen.getByRole('link', { name: /Open Builder/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/builder')
  })

  it('should display the getting started instructions', () => {
    render(<Home />)

    expect(screen.getByText(/npm run dev/)).toBeInTheDocument()
  })
})
