import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AZURE_AD_CLIENT_ID = 'c'
  process.env.AZURE_AD_CLIENT_SECRET = 's'
  process.env.AZURE_AD_TENANT_ID = 't'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
})

const mockStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mockStore) }))

describe('POST /auth/signout', () => {
  it('clears the session cookie and redirects to /auth/signin', async () => {
    mockStore.set.mockReset()
    const { POST } = await import('@/app/auth/signout/route')
    const req = new Request('http://localhost:3000/auth/signout', { method: 'POST' })
    const res = await POST(req as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/signin')
    expect(mockStore.set).toHaveBeenCalledWith(
      'session',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
  })
})
