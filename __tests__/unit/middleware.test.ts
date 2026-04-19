// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'
  process.env.APP_URL = 'http://localhost:3000'
  process.env.AZURE_AD_CLIENT_ID = 'x'
  process.env.AZURE_AD_CLIENT_SECRET = 'x'
  process.env.AZURE_AD_TENANT_ID = 'x'
})

function mkRequest(path: string, cookie?: string) {
  const req = new Request(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  })
  // Mimic NextRequest.cookies.get shape
  ;(req as any).nextUrl = new URL(req.url)
  ;(req as any).cookies = {
    get: (name: string) => {
      const m = (cookie ?? '').match(new RegExp(`${name}=([^;]+)`))
      return m ? { value: decodeURIComponent(m[1]) } : undefined
    },
  }
  return req as unknown as import('next/server').NextRequest
}

async function freshCookie() {
  const { encodeSession } = await import('@/lib/auth/session')
  return encodeSession({
    userId: 'u_1',
    entraOid: 'oid_1',
    roles: ['Approver'],
    name: null,
    email: null,
    photoUrl: null,
  })
}

describe('middleware', () => {
  it('redirects unauthenticated requests to /auth/signin with returnTo', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/approvals'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
    expect(res.headers.get('location')).toContain('returnTo=%2Fapprovals')
  })

  it('allows /auth/* without a session', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/auth/signin'))
    expect(res.status).toBe(200) // NextResponse.next() yields 200
  })

  it('allows authenticated requests to pass through', async () => {
    const cookie = `session=${encodeURIComponent(await freshCookie())}`
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/approvals', cookie))
    expect(res.status).toBe(200)
  })

  it('redirects when session cookie is tampered', async () => {
    const cookie = `session=not-a-valid-jwe`
    const { middleware } = await import('@/middleware')
    const res = await middleware(mkRequest('/approvals', cookie))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/auth/signin')
  })
})
