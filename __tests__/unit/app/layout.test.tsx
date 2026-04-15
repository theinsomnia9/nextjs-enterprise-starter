import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../setup/test-utils'
import RootLayout, { metadata } from '@/app/layout'

vi.mock('@/components/theme/ThemeToggle', () => ({
  default: () => <button aria-label="Toggle theme">Theme Toggle Mock</button>,
}))

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

  it('should include ThemeToggle component', () => {
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>
    )

    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
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
