import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

vi.mock('@/lib/auth/actor', () => ({
  getSessionForClient: vi.fn(),
}))

import { getSessionForClient } from '@/lib/auth/actor'
import { GET } from '@/app/api/me/route'

describe('GET /api/me', () => {
  it('returns 401 when no session is present', async () => {
    vi.mocked(getSessionForClient).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns the actor profile when signed in', async () => {
    vi.mocked(getSessionForClient).mockResolvedValue({
      userId: 'u_alice',
      roles: ['User'],
      name: 'Alice',
      email: 'alice@example.com',
      photoUrl: null,
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      id: 'u_alice',
      roles: ['User'],
      name: 'Alice',
      email: 'alice@example.com',
      photoUrl: null,
    })
  })
})
