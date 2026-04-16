import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../setup/test-utils'
import RootLayout, { metadata } from '@/app/layout'

vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-mock',
  }),
}))

describe('RootLayout', () => {
  it('should render children', () => {
    render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    )

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render with Inter font class', () => {
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    )

    expect(container.querySelector('.inter-mock')).toBeInTheDocument()
  })
})

describe('metadata', () => {
  it('should have correct title', () => {
    expect(metadata.title).toBe('Enterprise Boilerplate')
  })

  it('should have correct description', () => {
    expect(metadata.description).toContain('Production-ready')
  })
})
