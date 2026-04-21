import { describe, it, expect, vi, beforeAll } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockStore) }))

describe('POST /auth/signout', () => {
  it('clears session, sets post_logout flag, and redirects to Entra end-session', async () => {
    mockStore.set.mockReset()
    const { POST } = await import('@/app/auth/signout/route')
    const req = new Request('http://localhost:3000/auth/signout', { method: 'POST' })
    const res = await POST(req as never)
    expect(res.status).toBe(302)

    const location = res.headers.get('location') ?? ''
    const url = new URL(location)
    expect(url.origin).toBe('https://login.microsoftonline.com')
    expect(url.pathname).toBe('/x/oauth2/v2.0/logout')
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:3000/auth/signin'
    )
    expect(url.searchParams.get('client_id')).toBe('x')

    expect(mockStore.set).toHaveBeenCalledWith(
      'session',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
    expect(mockStore.set).toHaveBeenCalledWith(
      'post_logout',
      '1',
      expect.objectContaining({ path: '/auth/signin', maxAge: 300 })
    )
  })
})
