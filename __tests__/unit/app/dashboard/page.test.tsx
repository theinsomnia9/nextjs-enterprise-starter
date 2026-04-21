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
import Dashboard from '@/app/(protected)/dashboard/page'

describe('Dashboard page', () => {
  it('greets the signed-in user by name', async () => {
    render(await Dashboard())
    expect(
      screen.getByRole('heading', { name: /welcome, jane doe/i })
    ).toBeInTheDocument()
  })
})
