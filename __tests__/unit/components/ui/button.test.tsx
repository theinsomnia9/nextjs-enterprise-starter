import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../setup/test-utils'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders a button element by default', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined()
  })

  it('renders as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>
    )
    const el = screen.getByRole('link', { name: 'Link' })
    expect(el.tagName).toBe('A')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button', { name: 'Ghost' })
    expect(btn.className).toMatch(/hover:bg-accent/)
  })
})
