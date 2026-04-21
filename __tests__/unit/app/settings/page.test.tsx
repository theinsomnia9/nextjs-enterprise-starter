import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn().mockResolvedValue({
    userId: 'u1',
    roles: ['User'],
    name: 'Jane Doe',
    email: 'jane@example.com',
    photoUrl: null,
  }),
}))

import { render, screen } from '../../../setup/test-utils'
import Settings from '@/app/(protected)/settings/page'

describe('Settings (profile) page', () => {
  it('renders the user name, email, and role', async () => {
    render(await Settings())
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText(/role/i)).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
  })
})
