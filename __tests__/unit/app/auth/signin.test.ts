import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { setAuthEnvStub } from '../../../helpers/authEnv'

beforeAll(() => setAuthEnvStub())

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockStore) }))

const getAuthCodeUrl = vi.fn()
vi.mock('@/lib/auth/msal', () => ({
  getMsalClient: () => ({ getAuthCodeUrl }),
}))

describe('GET /auth/signin', () => {
  beforeEach(() => {
    mockStore.set.mockReset()
    getAuthCodeUrl.mockReset()
    getAuthCodeUrl.mockResolvedValue('https://login.microsoftonline.com/tenant/authorize?x=1')
  })

  it('redirects to the Entra auth URL with a signed oauth_pending cookie', async () => {
    const { GET } = await import('@/app/auth/signin/route')
    const req = new Request('http://localhost:3000/auth/signin')
    const res = await GET(req as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('login.microsoftonline.com')
    expect(mockStore.set).toHaveBeenCalledWith(
      'oauth_pending',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/auth/callback' })
    )
  })

  it('stores a valid returnTo in oauth_pending when query is present and safe', async () => {
    const { GET } = await import('@/app/auth/signin/route')
    const req = new Request('http://localhost:3000/auth/signin?returnTo=/approvals/1')
    await GET(req as never)
    const [, body] = mockStore.set.mock.calls[0]
    const decoded = JSON.parse(Buffer.from(body as string, 'base64').toString('utf8'))
    expect(decoded.returnTo).toBe('/approvals/1')
  })

  it('drops an unsafe returnTo', async () => {
    const { GET } = await import('@/app/auth/signin/route')
    const req = new Request('http://localhost:3000/auth/signin?returnTo=http://evil.com')
    await GET(req as never)
    const [, body] = mockStore.set.mock.calls[0]
    const decoded = JSON.parse(Buffer.from(body as string, 'base64').toString('utf8'))
    expect(decoded.returnTo).toBeNull()
  })
})
