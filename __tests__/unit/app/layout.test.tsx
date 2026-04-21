import { describe, it, expect, vi } from 'vitest'
import { setAuthEnvStub } from '../../helpers/authEnv'

setAuthEnvStub()

import { render, screen } from '../../setup/test-utils'
import RootLayout, { metadata } from '@/app/layout'

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn().mockResolvedValue(null),
}))

vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-mock',
  }),
}))

describe('RootLayout', () => {
  it('should render children', async () => {
    const node = await RootLayout({ children: <div>Test Content</div> })
    render(node as React.ReactElement)

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render with Inter font class', async () => {
    const node = (await RootLayout({ children: <div>Content</div> })) as React.ReactElement
    // Traverse the React tree because jsdom collapses <html>/<body> in render containers.
    const body = (node.props as { children: React.ReactElement }).children
    expect((body.props as { className: string }).className).toContain('inter-mock')
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
