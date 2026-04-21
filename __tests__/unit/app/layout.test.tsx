import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-mock',
  }),
}))

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn().mockResolvedValue(null),
}))

import { render, screen } from '../../setup/test-utils'
import RootLayout, { metadata } from '@/app/layout'

describe('RootLayout', () => {
  it('should render children', async () => {
    const ui = await RootLayout({ children: <div>Test Content</div> })
    render(ui)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render with Inter font class', async () => {
    const ui = await RootLayout({ children: <div>Content</div> })
    render(ui)
    // <body class="inter-mock"> is hoisted to the document, not the test container
    expect(document.querySelector('.inter-mock')).not.toBeNull()
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
