import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn(),
}))

import { render, screen } from '../../setup/test-utils'
import Home from '@/app/page'
import { getSessionForClient } from '@/lib/auth/actor'

describe('Home page', () => {
  it('shows "Sign in" CTA when unauthenticated', async () => {
    vi.mocked(getSessionForClient).mockResolvedValue(null)
    render(await Home())
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/auth/signin')
  })

  it('shows "Go to dashboard" CTA when authenticated', async () => {
    vi.mocked(getSessionForClient).mockResolvedValue({
      userId: 'u1',
      roles: ['User'],
      name: 'Jane',
      email: 'j@example.com',
      photoUrl: null,
    })
    render(await Home())
    const link = screen.getByRole('link', { name: /go to dashboard/i })
    expect(link).toHaveAttribute('href', '/dashboard')
  })
})
